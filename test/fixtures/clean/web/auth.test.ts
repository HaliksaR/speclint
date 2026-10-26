it("spec:auth/session-timeout#idle-timeout", () => {
  step("GIVEN a signed-in user");
  step("WHEN the user is idle for 30 minutes");
  step("THEN the session ends");
});
it("spec:auth/sign-in", () => {
  step("WHEN the user enters a valid password");
  step("THEN the user is signed in");
});
it("spec:identity/user-auth/user-record#new-user", () => {
  step("WHEN a user signs up");
  step("THEN a record is created");
});
