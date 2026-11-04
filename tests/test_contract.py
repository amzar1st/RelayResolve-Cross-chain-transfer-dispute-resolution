import copy
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
gl = types.SimpleNamespace(
    Contract=object, UserError=ValueError,
    public=types.SimpleNamespace(view=lambda fn: fn, write=lambda fn: fn),
    eq_principle=types.SimpleNamespace(strict_eq=lambda fn: fn()),
    nondet=types.SimpleNamespace(web=types.SimpleNamespace()),
)
with patch.dict(sys.modules, {"genlayer": types.SimpleNamespace(gl=gl, TreeMap=dict)}):
    spec = importlib.util.spec_from_file_location("relay_resolve", ROOT / "contracts/relay_resolve.py")
    relay = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(relay)


def fixture(name):
    return json.loads((ROOT / "tests/fixtures" / (name + ".json")).read_text())


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.origin = fixture("deposit")
        self.refund = fixture("refund")
        self.index = fixture("index")
        self.tx = self.origin["transactionHash"]
        self.deposit_id = int(self.index["depositId"])
        self.deposit = relay.deposit_from(self.origin, self.deposit_id)

    def observe(self):
        with patch.object(relay, "confirmed_receipt", side_effect=[self.origin, self.refund]), \
                patch.object(relay, "web_json", return_value=self.index):
            return relay.observe(self.tx, self.deposit_id)

    def test_real_refund(self):
        result = self.observe()
        self.assertEqual(result["outcome"], "REFUNDED")
        self.assertEqual(result["settlement"]["amount"], "295322271")
        self.assertEqual(result["settlement"]["bundle"], "30730")

    def test_stale_bridge_label_does_not_override_receipt(self):
        self.index["status"] = "expired"
        result = self.observe()
        self.assertEqual(result["bridge_status"], "expired")
        self.assertEqual(result["outcome"], "REFUNDED")

    def test_expired_without_settlement(self):
        self.index.update(status="expired", depositRefundTxnRef=None)
        self.assertEqual(self.observe()["outcome"], "UNRESOLVED")

    def test_conflicting_candidates(self):
        self.index["fillTxnRef"] = "0x" + "12" * 32
        self.assertEqual(self.observe()["reason"], "CONFLICTING_SETTLEMENT_REFERENCES")

    def test_wrong_index_route(self):
        self.index["destinationChainId"] = 42161
        self.assertEqual(self.observe()["reason"], "INDEX_NOT_VERIFIED")

    def test_wrong_source_pool(self):
        for log in self.origin["logs"]:
            if log["address"] == relay.ETH_POOL:
                log["address"] = relay.BASE_POOL
        self.assertEqual(self.observe()["reason"], "DEPOSIT_EVENT_NOT_MATCHED")

    def test_unrelated_refund_leaf(self):
        for log in self.refund["logs"]:
            if log["topics"][0] == relay.REFUND_ROOT:
                log["data"] = log["data"].replace(self.deposit["depositor"][2:], "ff" * 20)
        self.assertEqual(self.observe()["outcome"], "UNRESOLVED")

    def test_refund_wrong_amount(self):
        for log in self.refund["logs"]:
            if log["topics"][:3] == [relay.TRANSFER, relay.padded(relay.ETH_POOL), relay.padded(self.deposit["depositor"])]:
                log["data"] = relay.word(1)
        self.assertEqual(self.observe()["outcome"], "UNRESOLVED")

    def test_earlier_refund_is_rejected(self):
        self.refund["blockNumber"] = self.origin["blockNumber"]
        self.assertEqual(self.observe()["outcome"], "UNRESOLVED")

    def test_unfinalized_receipt(self):
        with patch.object(relay, "rpc", side_effect=[self.origin, {"number": "0x1"}]):
            with self.assertRaisesRegex(ValueError, "Unfinalized"):
                relay.confirmed_receipt(relay.ETH, self.tx)

    def test_fill_exact_amount_and_recipient(self):
        deposit = {**self.deposit, "message_size": 0}
        amount = relay.word(int(deposit["output_amount"]))
        recipient = relay.padded(deposit["recipient"])
        w = [
            relay.padded(deposit["input_token"]), relay.padded(deposit["output_token"]),
            relay.word(int(deposit["input_amount"])), amount, relay.word(1),
            relay.word(deposit["fill_deadline"]), relay.word(deposit["exclusivity_deadline"]),
            deposit["exclusive_relayer"], relay.padded(deposit["depositor"]), recipient,
            relay.word(0), recipient, relay.word(0), amount, relay.word(0),
        ]
        fill = {
            "transactionHash": "0x" + "34" * 32, "blockHash": self.refund["blockHash"],
            "logs": [
                {"address": relay.BASE_POOL, "topics": [relay.FILL, relay.word(1), relay.word(self.deposit_id), relay.word(5)],
                 "data": "0x" + "".join(word[2:] for word in w), "logIndex": "0x10"},
                {"address": deposit["output_token"], "topics": [relay.TRANSFER, relay.word(5), recipient],
                 "data": amount, "logIndex": "0x11"},
            ],
        }
        self.assertEqual(relay.fill_from(fill, deposit)["amount"], deposit["output_amount"])
        incorrect = copy.deepcopy(fill)
        incorrect["logs"][1]["data"] = relay.word(1)
        with self.assertRaisesRegex(ValueError, "unambiguous"):
            relay.fill_from(incorrect, deposit)
        with self.assertRaisesRegex(ValueError, "Embedded"):
            relay.fill_from(fill, self.deposit)


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.contract = relay.RelayResolve()
        self.contract.cases = {}
        self.tx = "0x" + "34" * 32

    def test_open_review_retry_finalize(self):
        with self.assertRaisesRegex(ValueError, "does not exist"):
            self.contract.review(self.tx, "1")
        self.contract.open_case(self.tx, "1")
        with self.assertRaisesRegex(ValueError, "already exists"):
            self.contract.open_case(self.tx, "1")
        with patch.object(relay, "observe", return_value={"outcome": "UNRESOLVED"}):
            self.contract.review(self.tx, "1")
        with self.assertRaisesRegex(ValueError, "verified settlement"):
            self.contract.finalize(self.tx, "1", "")
        with patch.object(relay, "observe", return_value={"outcome": "REFUNDED"}):
            self.contract.review(self.tx, "1")
        state = json.loads(self.contract.get_case(self.tx, "1"))
        self.assertEqual(state["revision"], 2)
        with self.assertRaisesRegex(ValueError, "Decision changed"):
            self.contract.finalize(self.tx, "1", "a" * 64)
        self.contract.finalize(self.tx, "1", state["decision_sha256"])
        self.assertEqual(json.loads(self.contract.get_case(self.tx, "1"))["stage"], "FINALIZED")
        with self.assertRaisesRegex(ValueError, "finalized"):
            self.contract.review(self.tx, "1")

    def test_rejects_noncanonical_id_and_bad_hash(self):
        for invalid in ("01", "-1", "1e3", str(2**256), "1" * 79):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.contract.open_case(self.tx, invalid)
        with self.assertRaises(ValueError):
            self.contract.open_case("https://invalid.test", "1")


if __name__ == "__main__":
    unittest.main()
