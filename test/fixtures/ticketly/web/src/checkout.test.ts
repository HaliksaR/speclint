const quote = /"/;
// spec:checkout/pay#card
test("card", () => { s(`WHEN the client pays by card`); s('THEN the order is confirmed') })
// spec:payments:charges/refund#partial-refund
test("partial", () => { s("WHEN the client returns one ticket"); s("THEN that ticket is refunded") })
test("graph", () => { expect(node.id).toBe("spec:alpha") })
