test("node ids", () => {
  expect(graph.nodes.map((n) => n.id)).toEqual(["spec:alpha", "spec:search/legacy"]);
});
