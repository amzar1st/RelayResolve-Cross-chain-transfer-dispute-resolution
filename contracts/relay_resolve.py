# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import hashlib
import json
import re

from genlayer import TreeMap, gl

ROUTE = "Across / Ethereum to Base"
ETH = "https://ethereum.publicnode.com"
BASE = "https://base.publicnode.com"
ETH_POOL = "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5"
BASE_POOL = "0x09aea4b2242abc8bb4bb78d537a67a245a7bec64"
DEPOSIT = "0x32ed1a409ef04c7b0227189c3a103dc5ac10e775a15b785dcc510201f7c25ad3"
FILL = "0x44b559f101f8fbcc8a0ea43fa91a05a729a5ea6e14a7c75aa750374690137208"
REFUND_ROOT = "0xf4ad92585b1bc117fbdd644990adf0827bc4c95baeae8a23322af807b6d0020e"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
HASH = r"0x[0-9a-f]{64}"
UINT = r"0|[1-9][0-9]{0,77}"
INDEX = "https://app.across.to/api/deposit/status?originChainId=1&depositId="
ROUTESCAN = "https://api.routescan.io/v2/network/mainnet/evm/"


def require(ok, reason):
    if not ok:
        raise gl.UserError(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def fingerprint(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def is_hash(value):
    return isinstance(value, str) and re.fullmatch(HASH, value) is not None


def word(number):
    return "0x" + format(number, "064x")


def address(value):
    if not is_hash(value) or value[2:26] != "0" * 24 or int(value, 16) == 0:
        raise ValueError("Expected a nonzero EVM address")
    return "0x" + value[26:]


def padded(addr):
    return "0x" + "0" * 24 + addr[2:]


def words(log):
    data = log["data"]
    if not re.fullmatch(r"0x(?:[0-9a-f]{64}){1,1024}", data):
        raise ValueError("Invalid ABI data")
    return ["0x" + data[i:i + 64] for i in range(2, len(data), 64)]


def web_json(url, body=None):
    if body is None:
        response = gl.nondet.web.get(url)
    else:
        response = gl.nondet.web.request(url, method="POST", body=canonical(body),
                                         headers={"Content-Type": "application/json"})
    if getattr(response, "status_code", getattr(response, "status", None)) != 200 or not 0 < len(response.body) <= 524288:
        raise ValueError("Unavailable source")
    return json.loads(response.body.decode("utf-8"))


def rpc(endpoint, method, params):
    chain = "1" if endpoint == ETH else "8453"
    args = "&txhash=" + params[0] if method == "eth_getTransactionReceipt" else "&tag=finalized&boolean=false"
    url = ROUTESCAN + chain + "/etherscan/api?module=proxy&action=" + method + args
    try:
        payload = web_json(url)
        if "result" in payload and not payload.get("error") and payload.get("jsonrpc") == "2.0":
            return payload["result"]
    except Exception:
        pass
    payload = web_json(endpoint, {"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    if payload.get("id") != 1 or payload.get("error"):
        raise ValueError("RPC rejected request")
    return payload["result"]


def confirmed_receipt(endpoint, tx):
    result = rpc(endpoint, "eth_getTransactionReceipt", [tx])
    if not result or result.get("transactionHash") != tx or result.get("status") != "0x1":
        raise ValueError("Missing successful receipt")
    if not is_hash(result.get("blockHash")) or not 0 < len(result["logs"]) <= 512:
        raise ValueError("Invalid receipt")
    head = rpc(endpoint, "eth_getBlockByNumber", ["finalized", False])
    if int(result["blockNumber"], 16) > int(head["number"], 16):
        raise ValueError("Unfinalized receipt")
    return result


def event(log, pool, topics):
    return log.get("address") == pool and log.get("removed", False) is False and log["topics"][:len(topics)] == topics


def deposit_from(receipt, deposit_id):
    matches = [log for log in receipt["logs"] if event(log, ETH_POOL, [DEPOSIT, word(8453), word(deposit_id)])]
    if len(matches) != 1 or len(matches[0]["topics"]) != 4:
        raise ValueError("Expected one supported deposit event")
    log = matches[0]
    w = words(log)
    if len(w) < 11 or int(w[9], 16) != 320 or not 0 <= int(w[10], 16) <= 4096:
        raise ValueError("Unsupported message encoding")
    message_size = int(w[10], 16)
    if len(w) != 11 + (message_size + 31) // 32:
        raise ValueError("Invalid message length")
    if not 0 < int(w[2], 16) or not 0 < int(w[3], 16):
        raise ValueError("Invalid amount")
    return {
        "id": str(deposit_id), "block_hash": receipt["blockHash"],
        "depositor": address(log["topics"][3]), "recipient": address(w[7]),
        "input_token": address(w[0]), "output_token": address(w[1]),
        "input_amount": str(int(w[2], 16)), "output_amount": str(int(w[3], 16)),
        "fill_deadline": int(w[5], 16), "exclusivity_deadline": int(w[6], 16),
        "exclusive_relayer": w[8], "message_size": message_size,
        "log_index": log["logIndex"],
    }


def array_words(data, offset):
    start, remainder = divmod(int(offset, 16), 32)
    if remainder or not 6 <= start < len(data):
        raise ValueError("Invalid refund array offset")
    length = int(data[start], 16)
    if not 0 < length <= 256 or start + 1 + length > len(data):
        raise ValueError("Invalid refund array length")
    return data[start + 1:start + 1 + length]


def refund_from(receipt, deposit):
    source = padded(ETH_POOL)
    recipient = padded(deposit["depositor"])
    matches = [log for log in receipt["logs"] if event(log, deposit["input_token"], [TRANSFER, source, recipient])
               and log["data"] == word(int(deposit["input_amount"]))]
    if len(matches) != 1:
        raise ValueError("Expected one full refund transfer")
    roots = []
    for log in receipt["logs"]:
        if event(log, ETH_POOL, [REFUND_ROOT, word(1)]):
            w = words(log)
            if len(log["topics"]) != 4 or len(w) < 6 or w[2] != padded(deposit["input_token"]):
                continue
            amounts = array_words(w, w[1])
            addresses = array_words(w, w[3])
            if len(amounts) == len(addresses) and list(zip(addresses, amounts)).count(
                (recipient, word(int(deposit["input_amount"])))
            ) == 1:
                roots.append(log)
    if len(roots) != 1:
        raise ValueError("Expected one token-matched Across refund root")
    return {"tx": receipt["transactionHash"], "block_hash": receipt["blockHash"],
            "transfer_log": matches[0]["logIndex"], "root_log": roots[0]["logIndex"],
            "bundle": str(int(roots[0]["topics"][2], 16)), "amount": deposit["input_amount"],
            "recipient": deposit["depositor"], "token": deposit["input_token"]}


def fill_from(receipt, deposit):
    # The MVP certifies plain transfers only. Embedded actions and speed-ups
    # have separate recipient, output and execution semantics.
    if deposit["message_size"] != 0:
        raise ValueError("Embedded-action delivery is outside the supported route profile")
    matches = [log for log in receipt["logs"] if event(log, BASE_POOL, [FILL, word(1), word(int(deposit["id"]))])]
    if len(matches) != 1:
        raise ValueError("Expected one matching Across fill")
    log = matches[0]
    w = words(log)
    empty = word(0)
    keccak_empty = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    if len(w) != 15 or [w[0], w[1], w[2], w[3], w[5], w[6], w[7], w[8], w[9], w[11], w[13]] != [
        padded(deposit["input_token"]), padded(deposit["output_token"]), word(int(deposit["input_amount"])),
        word(int(deposit["output_amount"])), word(deposit["fill_deadline"]), word(deposit["exclusivity_deadline"]),
        deposit["exclusive_relayer"], padded(deposit["depositor"]), padded(deposit["recipient"]),
        padded(deposit["recipient"]), word(int(deposit["output_amount"])),
    ] or w[10] not in (empty, keccak_empty) or w[12] not in (empty, keccak_empty):
        raise ValueError("Fill fields differ from source deposit")
    transfers = [l for l in receipt["logs"] if event(l, deposit["output_token"], [TRANSFER])
                 and len(l["topics"]) == 3 and l["topics"][2] == padded(deposit["recipient"])
                 and l["data"] == word(int(deposit["output_amount"]))]
    if len(transfers) != 1:
        raise ValueError("Missing unambiguous recipient token transfer")
    return {"tx": receipt["transactionHash"], "block_hash": receipt["blockHash"], "fill_log": log["logIndex"],
            "transfer_log": transfers[0]["logIndex"], "amount": deposit["output_amount"],
            "recipient": deposit["recipient"], "token": deposit["output_token"]}


def observe(source_tx, deposit_id):
    result = {"outcome": "UNRESOLVED", "reason": "SOURCE_NOT_VERIFIED", "source_tx": source_tx,
              "route": ROUTE, "index_url": INDEX + str(deposit_id)}
    try:
        source = confirmed_receipt(ETH, source_tx)
    except Exception:
        return result
    result["reason"] = "DEPOSIT_EVENT_NOT_MATCHED"
    try:
        deposit = deposit_from(source, deposit_id)
    except Exception:
        return result
    result["deposit"] = deposit
    result["reason"] = "INDEX_NOT_VERIFIED"
    try:
        index = web_json(result["index_url"])
        if (index.get("originChainId"), index.get("destinationChainId"), str(index.get("depositId")),
            index.get("depositTxnRef")) != (1, 8453, str(deposit_id), source_tx):
            return result
        fill_tx = index.get("fillTxnRef")
        refund_tx = index.get("depositRefundTxnRef")
        if ((fill_tx is not None and not is_hash(fill_tx)) or
                (refund_tx is not None and not is_hash(refund_tx))):
            return result
    except Exception:
        return result
    status = index.get("status")
    result["bridge_status"] = status if status in ("pending", "received", "expired", "failed", "filled", "refunded") else "unknown"
    if fill_tx and refund_tx:
        result["reason"] = "CONFLICTING_SETTLEMENT_REFERENCES"
        return result
    result["reason"] = "NO_VERIFIED_SETTLEMENT"
    try:
        if refund_tx and refund_tx != source_tx:
            receipt = confirmed_receipt(ETH, refund_tx)
            if int(receipt["blockNumber"], 16) <= int(source["blockNumber"], 16):
                return result
            result["settlement"] = refund_from(receipt, deposit)
            result.update(outcome="REFUNDED", reason="MATCHED_ACROSS_ORIGIN_REFUND")
        elif fill_tx:
            result["settlement"] = fill_from(confirmed_receipt(BASE, fill_tx), deposit)
            result.update(outcome="DELIVERED", reason="MATCHED_ACROSS_DESTINATION_FILL")
    except Exception:
        pass
    return result


class RelayResolve(gl.Contract):
    cases: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.view
    def route(self) -> str:
        return ROUTE

    @gl.public.view
    def get_case(self, source_tx: str, deposit_id: str) -> str:
        return self.cases.get(source_tx + ":" + deposit_id, "")

    @gl.public.write
    def open_case(self, source_tx: str, deposit_id: str) -> None:
        require(is_hash(source_tx), "Use a lowercase Ethereum transaction hash")
        require(len(deposit_id) <= 78 and re.fullmatch(UINT, deposit_id) is not None and
                int(deposit_id) < 2**256, "Use a decimal uint256 deposit ID")
        key = source_tx + ":" + deposit_id
        require(key not in self.cases, "Case already exists")
        self.cases[key] = canonical({"stage": "OPEN", "revision": 0})

    @gl.public.write
    def review(self, source_tx: str, deposit_id: str) -> None:
        key = source_tx + ":" + deposit_id
        require(key in self.cases, "Case does not exist")
        case = json.loads(self.cases[key])
        require(case["stage"] != "FINALIZED", "Case is finalized")
        require(case.get("decision", {}).get("outcome", "UNRESOLVED") == "UNRESOLVED",
                "Verified settlement already awaits finalization")
        number = int(deposit_id)

        def independently_observe() -> str:
            return canonical(observe(source_tx, number))

        decision = json.loads(gl.eq_principle.strict_eq(independently_observe))
        case = {"stage": "REVIEWED", "revision": case["revision"] + 1,
                "decision": decision, "decision_sha256": fingerprint(decision)}
        self.cases[key] = canonical(case)

    @gl.public.write
    def finalize(self, source_tx: str, deposit_id: str, decision_sha256: str) -> None:
        key = source_tx + ":" + deposit_id
        require(key in self.cases, "Case does not exist")
        case = json.loads(self.cases[key])
        require(case["stage"] == "REVIEWED" and case["decision"]["outcome"] in ("REFUNDED", "DELIVERED"),
                "Only verified settlement can finalize")
        require(case["decision_sha256"] == decision_sha256, "Decision changed")
        case["stage"] = "FINALIZED"
        self.cases[key] = canonical(case)
