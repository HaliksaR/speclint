package main

// spec:reviews/send-review#pending
func TestPending(t *testing.T) {
	t.Run("WHEN the customer sends a review", func(t *testing.T) {
		_ = `THEN the review
is pending`
	})
	_ = `THEN the review is pending`
}

// spec:reviews/send-review#reason-1–200-chars
func TestReason(t *testing.T) {
	_ = "WHEN the reason is empty"
}

// spec:reviews/send-review#pendng
func TestTypo(t *testing.T) {}
