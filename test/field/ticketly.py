import json, os, shutil, sys

ROOT = sys.argv[1]
shutil.rmtree(ROOT, ignore_errors=True)


def w(path, text):
    p = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        f.write(text.lstrip("\n"))


def spec(cap, reqs):
    out = f"# {cap} Specification\n\n## Purpose\nTBD.\n\n## Requirements\n\n"
    for name, scenarios in reqs:
        out += f"### Requirement: {name}\nThe system SHALL support {name.lower()}.\n\n"
        for sname, steps in scenarios:
            out += f"#### Scenario: {sname}\n" + "".join(f"- **{s.split(' ',1)[0]}** {s.split(' ',1)[1]}\n" for s in steps) + "\n"
    return out


def delta(sections):
    out = ""
    for title, reqs in sections:
        out += f"## {title} Requirements\n\n"
        for name, scenarios in reqs:
            out += f"### Requirement: {name}\nThe system SHALL support {name.lower()}.\n\n"
            for sname, steps in scenarios:
                out += f"#### Scenario: {sname}\n" + "".join(f"- **{s.split(' ',1)[0]}** {s.split(' ',1)[1]}\n" for s in steps) + "\n"
    return out


HOLD = [("Seats held", ["WHEN the client selects free seats", "THEN the seats are held for 10 minutes"]),
        ("Hold expires", ["GIVEN a hold older than 10 minutes", "WHEN the expiry job runs", "THEN the seats return to sale"])]
CANCEL = [("Free cancellation", ["WHEN the client cancels 24 hours before the event", "THEN the full price is refunded"])]
TIMEOUT = [("Истечение", ["WHEN срок брони истёк", "THEN бронь снимается"])]
LIST = [("Upcoming only", ["WHEN the client opens the catalog", "THEN only upcoming events are listed"])]

b = "platform/services/booking/openspec"
w(f"{b}/specs/reservations/spec.md", spec("reservations", [("Hold seats", HOLD), ("Cancel reservation", CANCEL), ("Тайм-аут брони", TIMEOUT)]))
w(f"{b}/specs/catalog/spec.md", spec("catalog", [("List events", LIST), ("List Events!", [("Any", ["WHEN x", "THEN y"])])]))

w(f"{b}/changes/add-waitlist/proposal.md", "# Add waitlist\n\nSee design.\n")
w(f"{b}/changes/add-waitlist/specs/reservations/spec.md", delta([
    ("ADDED", [("Waitlist", [("Join waitlist", ["WHEN the event is sold out", "THEN the client may join the waitlist"])])]),
    ("MODIFIED", [("Cancel reservation", CANCEL + [("Waitlist promotion", ["WHEN a reservation is cancelled", "THEN the first waitlisted client is offered the seats"])])]),
]))
w(f"{b}/changes/add-waitlist/design.md", """
# Design

- Holds: spec:reservations/hold-seats#seats-held
- Old name: spec:reservations/reserve-seats
- Removed search: spec:catalog/legacy-search
- Token store decision: spec:decision/0002-jwt
- Current decision: spec:decision/0003-paseto
- Capture: spec:payments:charges/capture-payment
- Refund everything: spec:payments:charges/refund-everything
- Own addition: spec:reservations/waitlist#join-waitlist
- Org protocol: spec:org:decision/0009-soap
- Not a reference: https://example.com/inspec:foo and file:spec:bar
- This change: spec:change/add-waitlist
- Archived change: spec:change/rename-hold

```text
spec:catalog/nonexistent-in-code-block
```
""")
w(f"{b}/changes/refund-policy/proposal.md", "# Refund policy\n")
w(f"{b}/changes/refund-policy/specs/reservations/spec.md", delta([("MODIFIED", [("Cancel reservation", CANCEL)])]))
w(f"{b}/changes/fix-typo/proposal.md", "# Fix typo\n")
w(f"{b}/changes/fix-typo/specs/catalog/spec.md", delta([("MODIFIED", [("List event", LIST)])]))
w(f"{b}/changes/dup-add/proposal.md", "# Dup\n")
w(f"{b}/changes/dup-add/specs/catalog/spec.md", delta([("ADDED", [("List events", LIST)])]))
w(f"{b}/changes/archive/2026-01-10-rename-hold/proposal.md", "# Rename\n")
w(f"{b}/changes/archive/2026-01-10-rename-hold/specs/reservations/spec.md",
  "## RENAMED Requirements\n\n- FROM: `### Requirement: Reserve seats`\n- TO: `### Requirement: Hold seats`\n")
w(f"{b}/changes/archive/2026-02-01-drop-legacy/proposal.md", "# Drop legacy\n\nOld link spec:catalog/legacy-search is fine in archive.\n")
w(f"{b}/changes/archive/2026-02-01-drop-legacy/specs/catalog/spec.md",
  "## REMOVED Requirements\n\n### Requirement: Legacy search\n**Reason**: replaced.\n**Migration**: none.\n")

w(f"{b}/decisions/0001-postgres.md", "---\nstatus: active\n---\n\n# Postgres\n\n## Rationale\n\nTransactions.\n")
w(f"{b}/decisions/0002-jwt.md", "---\nstatus: superseded\nsuperseded-by: 0003-paseto\n---\n\n# JWT\n\n## Rationale\n\nSimple. Replaced by spec:decision/0003-paseto.\n")
w(f"{b}/decisions/0003-paseto.md", "---\nstatus: active\n---\n\n# PASETO\n\nNo rationale section here.\n")
w(f"{b}/decisions/0004-bad.md", "---\nstatus: superseeded\n---\n\n# Typo status\n\n## Rationale\n\nx\n")

w("platform/services/booking/src/test/kotlin/ReservationsTest.kt", '''
class ReservationsTest {
    // spec:reservations/hold-seats#seats-held
    @Test fun seatsHeld() {
        step("WHEN the client selects free seats")
        step("THEN the seats are held for 10 minutes")
    }

    // spec:reservations/hold-seats#hold-expires
    @Test fun holdExpires() {
        val given = """GIVEN a hold older than 10 minutes"""
        step("WHEN the expiry job runs")
        step("THEN the seats return to Sale")
    }

    @Test fun `spec:reservations/cancel-reservation`() {
        step("WHEN the client cancels 24 hours before the event")
        step("THEN the full price is refunded")
    }

    // spec:reservations/тайм-аут-брони#истечение
    @Test fun timeout() {
        step("WHEN срок брони истёк")
        step("THEN бронь снимается")
    }

    // spec:reservations/old-thing
    @Test fun legacy() { val s = "it's \\"quoted\\" // not a comment" }
}
''')

p = "platform/services/payments/openspec"
w(f"{p}/specs/charges/spec.md", spec("charges", [
    ("Capture payment", [("Card approved", ["WHEN the bank approves the card", "THEN the payment is captured"])]),
    ("Refund", [("Partial refund", ["WHEN the client returns one ticket", "THEN that ticket is refunded"])]),
]))
w("platform/services/payments/tests/test_charges.py", '''
def test_card_approved():
    """spec:charges/capture-payment#card-approved"""
    steps = [f"WHEN the bank approves the card", r'THEN the payment is captured']
    # spec:charges/ghost
''')

w("platform/speclint.json", json.dumps({
    "roots": [{"path": "services/booking/openspec", "space": "booking"},
              {"path": "services/payments/openspec", "space": "payments"}],
    "dependencies": {"org": {"manifest": "speclint/org.manifest.json", "version": "1.2.0"}},
}, indent=2))

o = "org/openspec"
w(f"{o}/specs/governance/spec.md", spec("governance", [("Decision log", [("Recorded", ["WHEN a decision is made", "THEN it is recorded"])])]))
w(f"{o}/decisions/0009-soap.md", "---\nstatus: superseded\nsuperseded-by: 0010-rest\n---\n\n# SOAP\n\n## Rationale\n\nLegacy.\n")
w(f"{o}/decisions/0010-rest.md", "---\nstatus: active\n---\n\n# REST\n\n## Rationale\n\nTooling.\n")
w("org/speclint.json", json.dumps({"roots": [{"path": "openspec", "space": "org"}]}, indent=2))
w("org/tests/test_governance.py", 'def test_recorded():\n    """spec:governance/decision-log#recorded"""\n    s = ["WHEN a decision is made", "THEN it is recorded"]\n')

w("android/openspec/specs/app/spec.md", spec("app", [("Show tickets", [("Offline", ["WHEN the phone is offline", "THEN cached tickets are shown"])])]))
w("android/speclint.json", json.dumps({"roots": [{"path": "openspec", "space": "android"}],
    "dependencies": {"booking": {"manifest": "speclint/platform.manifest.json", "version": "3.0.0"}}}, indent=2))
w("android/app/src/test/kotlin/TicketsTest.kt", '''
class TicketsTest {
    // spec:app/show-tickets#offline
    @Test fun offline() { s("WHEN the phone is offline"); s("THEN cached tickets are shown") }

    // spec:booking:reservations/hold-seats#seats-held
    @Test fun hold() { s("WHEN the client selects free seats"); s("THEN the seats are held for 10 minutes") }

    // spec:booking:reservations/reserve-seats
    @Test fun old() {}

    // spec:payments:charges/refund
    @Test fun refund() {}
}
''')

w("ios/openspec/specs/app/spec.md", spec("app", [("Show tickets", [("Online", ["WHEN the phone is online", "THEN tickets sync"])])]))
w("ios/speclint.json", json.dumps({"roots": [{"path": "openspec", "space": "ios"}],
    "dependencies": {"booking": {"manifest": "speclint/platform.manifest.json", "version": "3.0.0"}}}, indent=2))
w("ios/AppTests/TicketsTests.swift", '''
final class TicketsTests: XCTestCase {
    // spec:app/show-tickets#online
    func testOnline() { s(#"WHEN the phone is online"#); s("THEN tickets sync") }

    // spec:booking:reservations/cancel-reservation
    func testCancel() { s("WHEN the client cancels 24 hours before the event") }
}
''')

w("web/openspec/specs/checkout/spec.md", spec("checkout", [("Pay", [("Card", ["WHEN the client pays by card", "THEN the order is confirmed"])])]))
w("web/speclint.json", json.dumps({"roots": [{"path": "openspec", "space": "web"}],
    "dependencies": {"payments": {"manifest": "speclint/platform.manifest.json", "version": "3.0.0"}}}, indent=2))
w("web/src/checkout.test.ts", '''
const quote = /"/;
// spec:checkout/pay#card
test("card", () => { s(`WHEN the client pays by card`); s('THEN the order is confirmed') })
// spec:payments:charges/refund#partial-refund
test("partial", () => { s("WHEN the client returns one ticket"); s("THEN that ticket is refunded") })
''')
