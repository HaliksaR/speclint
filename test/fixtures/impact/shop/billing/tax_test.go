package billing

import "testing"

// spec:billing:tax/vat#large-total
func TestLargeTotal(t *testing.T) {
	if Tax(200) != 40 {
		t.Fatal("tax")
	}
}

// spec:billing:tax/vat#small-total
func TestSmallTotal(t *testing.T) {
	if Tax(50) != 0 {
		t.Fatal("tax")
	}
}
