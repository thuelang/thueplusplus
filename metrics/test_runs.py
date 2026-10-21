#!/usr/bin/env python3
"""Host selection and committed-cost checks. No interpreters."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from layout import Case, Limits, Solution, discover, discover_versions
from runs import (
    RunError,
    _require_parity,
    _write_metrics,
    check_committed,
    entry_complete,
    measure_kept,
    select_pending,
    selected_hosts,
    version_record,
)


def _run(host: str, cost: int, *, passed: bool = True) -> dict:
    return {
        "problem": "hello-world",
        "ruleset": "direct",
        "case": "01-hello",
        "host": host,
        "pass": passed,
        "cost": cost,
    }


class RunsTest(unittest.TestCase):
    def test_host_selects_one_interpreter(self) -> None:
        self.assertIsNone(selected_hosts(""))
        self.assertIsNone(selected_hosts("  "))
        self.assertEqual(selected_hosts("python"), ("python",))

    def test_parity_uses_go_when_present(self) -> None:
        _require_parity([_run("python", 4), _run("go", 4)])
        with self.assertRaises(RunError) as caught:
            _require_parity([_run("python", 5), _run("go", 4)])
        self.assertIn("!= go", str(caught.exception))

    def test_parity_without_go_still_requires_a_pass(self) -> None:
        _require_parity([_run("python", 4)])
        with self.assertRaises(RunError) as caught:
            _require_parity([_run("python", 4, passed=False)])
        self.assertIn("failed on python", str(caught.exception))

    def test_a_single_host_must_match_the_committed_cost(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root / "metrics" / "versions.json"
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({
                "schema_version": 1,
                "versions": {
                    "abc123abc123": {
                        "problem": "hello-world",
                        "ruleset": "direct",
                        "timestamp": "2026-10-20_14-34-00",
                        "pass": True,
                        "cost": 4,
                        "current": True,
                    }
                },
            }) + "\n", encoding="utf-8")
            check_committed([_run("python", 4)], root=root)
            with self.assertRaises(RunError) as caught:
                check_committed([_run("python", 9)], root=root)
            self.assertIn("!= python measured 9", str(caught.exception))


def _version(problem: str, ruleset: str, timestamp: str) -> Solution:
    direct = ruleset == "direct"
    extension = "thue" if direct else "lisp"
    return Solution(
        problem=problem,
        ruleset=ruleset,
        entry=f"sample.{extension}",
        entry_path=f"problems/{problem}/solutions/{ruleset}/{timestamp}/sample.{extension}",
        author="Ada",
        notes="Notes.",
        program=f"problems/{problem}/solutions/{ruleset}/{timestamp}/sample.thue" if direct else f"langs/{ruleset}/{ruleset}.thue",
        state="x",
        direct=direct,
        slug="sample",
        timestamp=timestamp,
    )


def _pass_row(cost: int, case: str = "ten") -> dict:
    return {
        "pass": True,
        "case": case,
        "host": "go",
        "problem": "factorial",
        "ruleset": "lisp",
        "cost": cost,
        "applied_steps": 2,
        "regex_evals": 3,
        "regex_matches": 1,
        "state_bytes": 4,
        "state_peak": 4,
        "rule_count": 6,
        "rule_chars": 7,
    }


class KeptVersionTest(unittest.TestCase):
    def test_pending_keeps_older_and_direct_versions_that_are_not_recorded(self) -> None:
        lisp = _version("factorial", "lisp", "2026-10-16_13-47-12")
        current = _version("factorial", "lisp", "2026-10-17_13-58-55")
        basic = _version("factorial", "basic", "2026-10-16_15-37-17")
        direct = _version("rot-13", "direct", "2026-10-17_14-16-44")
        direct_current = _version("rot-13", "direct", "2026-10-18_05-52-13")
        recorded = {
            "basic": {
                "problem": "factorial",
                "ruleset": "basic",
                "timestamp": basic.timestamp,
                "pass": True,
                "cost": 9,
            },
            "failed": {
                "problem": "rot-13",
                "ruleset": "direct",
                "timestamp": direct.timestamp,
                "pass": False,
                "reason": "exit 1",
            },
            "bare": {
                "problem": "fizzbuzz",
                "ruleset": "lisp",
                "timestamp": "2026-10-20_12-16-45",
                "pass": True,
            },
        }
        bare = _version("fizzbuzz", "lisp", "2026-10-20_12-16-45")
        pending = select_pending([lisp, current, basic, direct, direct_current, bare], [current, direct_current], recorded)
        self.assertEqual(
            [(item.problem, item.ruleset, item.timestamp) for item in pending],
            [(lisp.problem, lisp.ruleset, lisp.timestamp), (bare.problem, bare.ruleset, bare.timestamp)],
        )
        self.assertFalse(entry_complete({"pass": True, "cost": True}))
        self.assertFalse(entry_complete({"pass": False, "reason": "  "}))
        self.assertTrue(entry_complete(recorded["failed"]))

    def test_discover_versions_includes_older_timestamps(self) -> None:
        currents = {(item.problem, item.ruleset, item.timestamp) for item in discover()}
        every = discover_versions()
        older = [item for item in every if (item.problem, item.ruleset, item.timestamp) not in currents]
        self.assertGreater(len(older), 0)
        lisp = next(item for item in older if item.problem == "factorial" and item.ruleset == "lisp")
        self.assertEqual(lisp.timestamp, "2026-10-16_13-47-12")
        self.assertIn("while", lisp.entry)
        self.assertTrue(lisp.state)
        self.assertTrue(any(item.ruleset == "direct" for item in older))
        recorded = {
            (item.problem, item.ruleset, item.timestamp): {
                "problem": item.problem,
                "ruleset": item.ruleset,
                "timestamp": item.timestamp,
                "pass": True,
                "cost": 1,
            }
            for item in older
        }
        self.assertEqual(select_pending(every, discover(), recorded), [])

    def test_a_non_current_version_is_measured(self) -> None:
        older = _version("factorial", "lisp", "2026-10-16_13-47-12")
        case = Case("ten", {}, {"stdout": "3628800"}, 0)
        seen: list[tuple[str, str, bool]] = []

        def run_one(interpreter, solution: Solution, item: Case, limits: Limits, *, fatal: bool = True) -> dict:
            seen.append((solution.timestamp, item.name, fatal))
            row = _pass_row(11, item.name)
            row["detail"] = ""
            return row

        documents = measure_kept(object(), [(older, [case])], Limits(1, 1, 1, 1, 1), "a" * 40, run_one=run_one)
        self.assertEqual(seen, [(older.timestamp, "ten", False)])
        self.assertEqual(documents[0]["cost"], 11)
        self.assertEqual(documents[0]["applied_steps"], 2)
        self.assertEqual(documents[0]["rule_count"], 6)
        self.assertIs(documents[0]["pass"], True)
        self.assertIs(documents[0]["current"], False)
        self.assertNotIn("unmeasured", json.dumps(documents))
        current = _version("factorial", "lisp", "2026-10-17_13-58-55")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wrote = _write_metrics([current], [_pass_row(4)], "b" * 40, root=root, kept=documents)
            self.assertEqual(wrote, ["metrics/versions.json"])
            text = (root / "metrics" / "versions.json").read_text(encoding="utf-8")
            self.assertNotIn("unmeasured", text)
            saved = json.loads(text)["versions"]
            currents = [entry for entry in saved.values() if entry["current"] is True]
            self.assertEqual([entry["timestamp"] for entry in currents], [current.timestamp])
            self.assertEqual(currents[0]["cost"], 4)
            old = next(entry for entry in saved.values() if entry["timestamp"] == older.timestamp)
            self.assertEqual(old["cost"], 11)
            self.assertIs(old["current"], False)
            again = _write_metrics([current], [_pass_row(4)], "c" * 40, root=root, kept=documents)
            self.assertEqual(again, [])

    def test_a_failing_old_version_is_a_failure(self) -> None:
        older = _version("factorial", "forth", "2026-10-16_13-47-12")
        first = Case("ten", {}, {"stdout": "3628800"}, 0)
        second = Case("zero", {}, {"stdout": "1"}, 0)
        seen: list[str] = []

        def run_one(interpreter, solution: Solution, item: Case, limits: Limits, *, fatal: bool = True) -> dict:
            seen.append(item.name)
            self.assertFalse(fatal)
            return {"pass": False, "case": item.name, "detail": "exit 2; writes mismatch"}

        documents = measure_kept(object(), [(older, [first, second])], Limits(1, 1, 1, 1, 1), "d" * 40, run_one=run_one)
        self.assertEqual(seen, ["ten"])
        self.assertIs(documents[0]["pass"], False)
        self.assertIs(documents[0]["current"], False)
        self.assertEqual(documents[0]["reason"], "ten: exit 2; writes mismatch")
        self.assertNotIn("cost", documents[0])
        self.assertNotIn("unmeasured", json.dumps(documents))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wrote = _write_metrics([], [], "d" * 40, root=root, kept=documents)
            self.assertEqual(wrote, ["metrics/versions.json"])
            text = (root / "metrics" / "versions.json").read_text(encoding="utf-8")
            self.assertNotIn("unmeasured", text)
            saved = next(iter(json.loads(text)["versions"].values()))
            self.assertIs(saved["pass"], False)
            self.assertEqual(saved["reason"], "ten: exit 2; writes mismatch")
            self.assertNotIn("cost", saved)


if __name__ == "__main__":
    unittest.main()
