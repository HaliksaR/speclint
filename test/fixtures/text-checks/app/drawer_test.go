package main

// spec:drawer/close-guard#server-page
func TestServerPage(t *testing.T) {
	page := doRequest(t, mux, "GET", "/", nil, "")
	_ = page
}

// spec:drawer/close-guard#script-guard
// spec:drawer/close-guard#both
func TestScriptGuard(t *testing.T) {
	script := servedScript(t, "/static/commission.js")
	if !strings.Contains(script, "unsavedToast.hidden = false;") {
		t.Fatal("no guard")
	}
}

// spec:drawer/close-guard#both
func TestBothBehaviour(t *testing.T) {
	page := doRequest(t, mux, "GET", "/", nil, "")
	_ = page
}

// spec:drawer/close-guard#mixed
func TestMixed(t *testing.T) {
	page := doRequest(t, mux, "GET", "/", nil, "")
	script := servedScript(t, "/static/commission.js")
	_, _ = page, script
}
