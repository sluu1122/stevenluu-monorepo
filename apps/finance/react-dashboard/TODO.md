# TODO

Things worth revisiting that came out of engine audits but weren't fully
chased down or fixed. Not bugs necessarily — some are deliberate tradeoffs
that might deserve a second look, some are small residuals nobody's
root-caused yet. Add to this list rather than losing track of it in chat.

## Shared-account flow attribution on the non-primary spouse's row

A joint account's growth, contributions, and withdrawals are recorded only on
the *primary* person's row (see `invariants.ts`'s `sharedBucketIds` handling
and the comment in `ledger.ts` around Phase 5 row finalization). This is
deliberate and tested — it's what lets `combineLedgers` sum flows without
double-counting a joint account across both owners.

Side effect: if a user switches the Planning Grid's person selector to the
*non-primary* spouse, a joint account shows its balance changing with no
growth/withdrawal line to explain it. The numbers are correct, just not
self-explanatory from that one view. A real fix would mean mirroring those
flows onto every owner's row *and* changing `combineLedgers`'s merge logic to
dedupe (not sum) shared-bucket entries — bigger and riskier than it sounds,
worth designing carefully rather than doing reactively.

## Residual capital-gains overcharge, 2081-2083 (~$20-$112/year)

From the original household audit, before the Phase 1c cost-basis fix: three
years right at the end of the projection were still charging capital gains
tax slightly above the "all gains" upper bound the audit used to sanity-check
the tax math. Never re-verified after the Phase 1c fix landed — might already
be resolved, might not be. Needs a fresh bounded-tax-check pass against the
current engine to confirm either way.

## Residual gain on cash-only-sale years (~2% of remaining charged gains, 2061-2083)

Also from the original household audit: a small amount of capital gain
(roughly $235-$395/year) kept showing up in years where only a cash account
was sold, even after the Phase 1c fix eliminated the bulk of that class of
bug. Suspected cause: interest is credited against a cash account's *opening*
balance while growth is applied post-flow, so a sliver of interest ends up
taxed at capital-gains inclusion rather than 100% as ordinary income. Small
dollar amount, but the mechanism was never confirmed.

## Surplus banked to cash by default (no investment)

`PersonPlan.surplusDestinationAccountBucketId` defaults to `null`, which
routes 100% of a person's after-tax leftover income into their cash-buffer
account rather than investing it. For anyone whose income comfortably exceeds
spending + contributions, this quietly strands decades of savings at cash
yields instead of market returns — the engine does exactly what's configured,
but the default is easy to leave unconfigured without realizing the cost.
Worth a UI nudge (e.g., a warning when surplus is large and destination is
unset) rather than an engine change.

## Meltdown tax pricing when both spouses melt down in the same year (MFJ)

Added while fixing joint taxation: under a joint return, two spouses' RMDs
and cash-buffer replenishments correctly price against a shared, live-updated
household tax base (see `bumpSharedTaxBase` in `ledger.ts`). Meltdowns don't
get the same live update — each spouse's meltdown tax is priced against a
combined base frozen at the start of Phase 2d, so if BOTH spouses have an
active meltdown rule firing in the same year, the second one processed doesn't
see the first one's income yet. Narrow case (requires two simultaneous
meltdown rules under MFJ) and documented in code, but not actually fixed.
