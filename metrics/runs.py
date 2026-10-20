"""Run every solution case on every host and record schema 5 runs."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "metrics"))
sys.path.insert(0, str(ROOT / "tools"))

import historylib  # noqa: E402
from hosts import build_registered  # noqa: E402
from layout import Case, Limits, Solution, discover, load_cases, load_limits  # noqa: E402
from run_limits import bounded_run  # noqa: E402

RUN_FIELDS = (
    "program",
    "problem",
    "ruleset",
    "case",
    "host",
    "environment",
    "state",
    "reads",
    "max_steps",
    "max_evals",
    "max_state_bytes",
    "timeout_seconds",
    "memory_cap_bytes",
    "host_timeout_seconds",
    "pass",
    "cost",
    "applied_steps",
    "regex_evals",
    "regex_matches",
    "state_bytes",
    "state_peak",
    "rule_count",
    "rule_chars",
    "duration_ms",
    "memory_bytes",
    "exit_code",
)
METRIC_FIELDS = (
    "pass",
    "cost",
    "commit",
    "applied_steps",
    "regex_evals",
    "regex_matches",
    "state_bytes",
    "state_peak",
    "rule_count",
    "rule_chars",
)
DIAGNOSTICS = (
    "applied_steps",
    "regex_evals",
    "regex_matches",
    "state_bytes",
    "state_peak",
    "rule_count",
    "rule_chars",
)


class RunError(RuntimeError):
    pass


def selected_hosts(host: str | None = None) -> tuple[str, ...] | None:
    """Return the one host named by HOST, or None when every host should run."""
    if host is None:
        host = os.environ.get("HOST", "")
    host = host.strip()
    if host == "":
        return None
    return (host,)


def measure(*, write_metrics: bool, commit: str, hosts: tuple[str, ...] | None = None) -> list[dict]:
    limits = load_limits()
    solutions = discover()
    cases = {solution.problem: load_cases(solution.problem) for solution in solutions}
    interpreters = build_registered(ROOT / "build", hosts)
    jobs = [(solution, case) for solution in solutions for case in cases[solution.problem]]
    by_host: dict[str, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=len(interpreters)) as pool:
        futures = {
            interpreter.name: pool.submit(_run_host, interpreter, jobs, limits)
            for interpreter in interpreters
        }
        for name, future in futures.items():
            by_host[name] = future.result()
    runs: list[dict] = []
    for index in range(len(jobs)):
        for interpreter in interpreters:
            runs.append(by_host[interpreter.name][index])
    _require_parity(runs)
    if write_metrics:
        if hosts is not None and "go" not in hosts:
            raise RunError("writing metrics requires the go host")
        _write_metrics(solutions, runs, commit)
    return runs


def _run_host(interpreter, jobs: list[tuple[Solution, Case]], limits: Limits) -> list[dict]:
    return [_run_measured(interpreter, solution, case, limits) for solution, case in jobs]


def _run_measured(interpreter, solution: Solution, case: Case, limits: Limits) -> dict:
    """Rerun a pass that exited before the resident-memory sample, up to five times."""
    row = _run_one(interpreter, solution, case, limits)
    for _attempt in range(4):
        memory = row["memory_bytes"]
        if row["pass"] is not True or (isinstance(memory, int) and not isinstance(memory, bool) and memory > 0):
            return row
        row = _run_one(interpreter, solution, case, limits)
    return row


def _run_one(interpreter, solution: Solution, case: Case, limits: Limits) -> dict:
    environment = historylib.environment_for(interpreter.name)
    base = {
        "program": solution.program,
        "problem": solution.problem,
        "ruleset": solution.ruleset,
        "case": case.name,
        "host": interpreter.name,
        "environment": environment,
        "state": solution.state,
        "reads": {name: list(lines) for name, lines in case.reads.items()},
        "max_steps": limits.max_steps,
        "max_evals": limits.max_evals,
        "max_state_bytes": limits.max_state_bytes,
        "timeout_seconds": limits.timeout_seconds,
        "memory_cap_bytes": limits.memory_cap_bytes,
        "host_timeout_seconds": limits.timeout_seconds,
    }
    with tempfile.TemporaryDirectory(prefix="thuepp-run-") as tmp:
        metrics_path = Path(tmp) / "metrics.json"
        resources_path = Path(tmp) / "resources.json"
        resource_out = Path(tmp) / "resource-out.json"
        resources_path.write_text(
            json.dumps(
                {
                    "reads": {name: list(lines) for name, lines in case.reads.items()},
                    "writes": sorted(case.writes),
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        argv = [*interpreter.argv, str(ROOT / solution.program), "--metrics", str(metrics_path)]
        argv.extend(["--resources", str(resources_path), "--resource-out", str(resource_out)])
        if not solution.direct:
            argv.extend(["--input", solution.state])
        if solution.ruleset == "expr":
            stdin_text = "\n".join(case.reads.get("stdin", ()))
            argv.extend(["--line:env", json.dumps({"stdin": stdin_text})])
        argv.extend([
            "--max-steps", str(limits.max_steps),
            "--max-evals", str(limits.max_evals),
            "--max-state-bytes", str(limits.max_state_bytes),
        ])
        started = time.perf_counter()
        child_env = os.environ.copy()
        child_env.update(dict(interpreter.env))
        try:
            completed = bounded_run(
                argv,
                timeout=limits.timeout_seconds,
                cwd=ROOT,
                env=child_env,
                input_text="",
                memory_cap=limits.memory_cap_bytes,
            )
        except RuntimeError as exc:
            duration = int((time.perf_counter() - started) * 1000)
            if interpreter.name == "go":
                raise RunError(f"{solution.problem}/{solution.ruleset}/{case.name} failed on go: {exc}") from exc
            return _finish(base, passed=False, metrics=None, duration=duration, memory=None, exit_code=None, detail=str(exc))
        duration = int((time.perf_counter() - started) * 1000)
        memory = getattr(completed, "peak_rss_bytes", None)
        metrics = None
        if metrics_path.is_file():
            try:
                metrics = historylib.parse_metrics(metrics_path.read_text(encoding="utf-8"))
            except historylib.HistoryError as exc:
                if interpreter.name == "go":
                    raise RunError(f"{solution.problem}/{solution.ruleset}/{case.name} failed on go: {exc}") from exc
                return _finish(base, passed=False, metrics=None, duration=duration, memory=memory, exit_code=completed.returncode, detail=str(exc))
        recorded = None
        if resource_out.is_file():
            try:
                recorded = json.loads(resource_out.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                recorded = None
        passed = (
            completed.returncode == case.exit_code
            and completed.stderr == ""
            and recorded == case.writes
            and metrics is not None
        )
        detail = "" if passed else _mismatch(case, completed, recorded, metrics)
        row = _finish(base, passed=passed, metrics=metrics if passed else None, duration=duration, memory=memory, exit_code=completed.returncode, detail=detail)
        if interpreter.name == "go" and not passed:
            raise RunError(f"{solution.problem}/{solution.ruleset}/{case.name} failed on go: {detail}")
        return row


def _mismatch(case: Case, completed, recorded, metrics: dict | None) -> str:
    parts = [f"exit {completed.returncode}"]
    if completed.stderr:
        parts.append(completed.stderr.strip())
    if recorded != case.writes:
        parts.append("writes mismatch")
    if metrics is None:
        parts.append("missing metrics")
    return "; ".join(parts)


def _finish(base: dict, *, passed: bool, metrics: dict | None, duration: int, memory: int | None, exit_code: int | None, detail: str) -> dict:
    row = dict(base)
    row["pass"] = passed
    row["duration_ms"] = duration
    row["memory_bytes"] = memory
    row["exit_code"] = exit_code
    if passed and metrics is not None:
        row["cost"] = metrics["cost"]
        for key in DIAGNOSTICS:
            row[key] = metrics[key]
    else:
        row["cost"] = None
        for key in DIAGNOSTICS:
            row[key] = None
        row["detail"] = detail
    return {key: row[key] for key in RUN_FIELDS}


def _require_parity(runs: list[dict]) -> None:
    grouped: dict[tuple[str, str, str], dict[str, dict]] = {}
    for run in runs:
        grouped.setdefault((run["problem"], run["ruleset"], run["case"]), {})[run["host"]] = run
    for key, hosts in grouped.items():
        if not hosts:
            raise RunError(f"{'/'.join(key)} has no runs")
        reference_name = "go" if "go" in hosts else sorted(hosts)[0]
        reference = hosts[reference_name]
        if reference["pass"] is not True:
            raise RunError(f"{'/'.join(key)} failed on {reference_name}")
        for host, run in hosts.items():
            if run["pass"] != reference["pass"] or run["cost"] != reference["cost"]:
                raise RunError(
                    f"{'/'.join(key)} {host} pass={run['pass']} cost={run['cost']} "
                    f"!= {reference_name} pass={reference['pass']} cost={reference['cost']}"
                )


VERSIONS_REL = "metrics/versions.json"


def _metric_document(solution: Solution, rows: list[dict], commit: str) -> dict:
    return {
        "problem": solution.problem,
        "ruleset": solution.ruleset,
        "timestamp": solution.timestamp,
        "pass": True,
        "cost": sum(row["cost"] for row in rows),
        "commit": commit,
        "applied_steps": sum(row["applied_steps"] for row in rows),
        "regex_evals": sum(row["regex_evals"] for row in rows),
        "regex_matches": sum(row["regex_matches"] for row in rows),
        "state_bytes": sum(row["state_bytes"] for row in rows),
        "state_peak": max(row["state_peak"] for row in rows),
        "rule_count": rows[-1]["rule_count"],
        "rule_chars": rows[-1]["rule_chars"],
        "current": True,
    }


def _same_metric(existing: dict, document: dict) -> bool:
    if existing.get("current") is not True:
        return False
    if existing.get("problem") != document["problem"] or existing.get("ruleset") != document["ruleset"]:
        return False
    if existing.get("timestamp") != document["timestamp"]:
        return False
    return all(existing.get(key) == document[key] for key in METRIC_FIELDS if key != "commit")


def _valid_cost_point(point: object) -> bool:
    if not isinstance(point, dict):
        return False
    recorded = point.get("commit")
    cost = point.get("cost")
    return (
        isinstance(point.get("problem"), str)
        and isinstance(point.get("ruleset"), str)
        and isinstance(recorded, str)
        and len(recorded) == 40
        and all(character in "0123456789abcdef" for character in recorded)
        and isinstance(cost, int)
        and not isinstance(cost, bool)
        and cost >= 0
    )


def load_versions(root: Path = ROOT) -> dict:
    path = root / VERSIONS_REL
    if not path.is_file():
        return {"schema_version": 1, "versions": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("schema_version") != 1 or not isinstance(data.get("versions"), dict):
        raise RunError(f"{VERSIONS_REL} is not schema 1")
    points = data.get("points", [])
    if not isinstance(points, list) or any(not _valid_cost_point(point) for point in points):
        raise RunError(f"{VERSIONS_REL} points must be cost changes tied to a commit")
    return data


def _last_recorded_cost(document: dict, problem: str, ruleset: str) -> int | None:
    for point in reversed(document.get("points") or []):
        if point.get("problem") == problem and point.get("ruleset") == ruleset:
            return point["cost"]
    for entry in document["versions"].values():
        if (
            isinstance(entry, dict)
            and entry.get("problem") == problem
            and entry.get("ruleset") == ruleset
            and entry.get("current") is True
            and isinstance(entry.get("cost"), int)
            and not isinstance(entry.get("cost"), bool)
        ):
            return entry["cost"]
    return None


def _cost_point(solution: Solution, entry: dict) -> dict:
    point = {
        "problem": solution.problem,
        "ruleset": solution.ruleset,
        "hash": solution.hash,
        "version": solution.timestamp,
    }
    for key in ("pass", "cost", "commit", *DIAGNOSTICS):
        point[key] = entry[key]
    return point


def _write_metrics(solutions: list[Solution], runs: list[dict], commit: str, *, root: Path = ROOT) -> list[str]:
    """Write metrics/versions.json when a current version's pass, cost, or diagnostics changed.

    A cost point is appended only when the cost differs from the last recorded value.
    `commit` is the commit that was measured. It is not a change by itself, and it is
    not written into the version directory. Returns repo-relative paths that were written.
    A failing Go run writes nothing.
    """
    grouped: dict[tuple[str, str], list[dict]] = {}
    for run in runs:
        if run["host"] != "go":
            continue
        grouped.setdefault((run["problem"], run["ruleset"]), []).append(run)
    pending: list[tuple[Solution, list[dict]]] = []
    for solution in solutions:
        if not solution.hash:
            raise RunError(f"{solution.problem}/{solution.ruleset} has no version hash")
        rows = grouped[(solution.problem, solution.ruleset)]
        if any(row["pass"] is not True for row in rows):
            raise RunError(f"{solution.problem}/{solution.ruleset} did not pass")
        pending.append((solution, rows))
    document = load_versions(root)
    versions = document["versions"]
    changed = False
    for solution, rows in pending:
        entry = _metric_document(solution, rows, commit)
        last_cost = _last_recorded_cost(document, solution.problem, solution.ruleset)
        for other_hash, other in versions.items():
            if other_hash == solution.hash or not isinstance(other, dict):
                continue
            if other.get("problem") == solution.problem and other.get("ruleset") == solution.ruleset and other.get("current") is True:
                other["current"] = False
                changed = True
        existing = versions.get(solution.hash)
        if isinstance(existing, dict) and _same_metric(existing, entry):
            continue
        versions[solution.hash] = entry
        changed = True
        if last_cost is None or entry["cost"] != last_cost:
            if not _valid_cost_point(_cost_point(solution, entry)):
                raise RunError(f"{solution.problem}/{solution.ruleset} cost point at {commit} is not a commit")
            document.setdefault("points", []).append(_cost_point(solution, entry))
    if not changed:
        return []
    path = root / VERSIONS_REL
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    return [VERSIONS_REL]


def check_committed(runs: list[dict], *, root: Path = ROOT) -> None:
    grouped: dict[tuple[str, str, str], list[dict]] = {}
    for run in runs:
        grouped.setdefault((run["problem"], run["ruleset"], run["host"]), []).append(run)
    if not grouped:
        raise RunError("no runs")
    versions = load_versions(root)["versions"]
    for problem, ruleset, host in sorted(grouped):
        rows = grouped[(problem, ruleset, host)]
        if any(row["pass"] is not True for row in rows):
            raise RunError(f"{problem}/{ruleset} failed on {host}")
        current = [
            entry
            for entry in versions.values()
            if isinstance(entry, dict) and entry.get("problem") == problem and entry.get("ruleset") == ruleset and entry.get("current") is True
        ]
        if len(current) != 1:
            raise RunError(f"{VERSIONS_REL} needs one current {problem}/{ruleset}")
        cost = sum(row["cost"] for row in rows)
        recorded = current[0].get("cost")
        if current[0].get("pass") is not True or recorded != cost:
            raise RunError(f"{VERSIONS_REL} cost {recorded} != {host} measured {cost}")
