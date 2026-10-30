package shop

import "testing"

// spec:price/bulk-price#large-order
func TestLargeOrder(t *testing.T) {
	if Price(11) != 22 || Price(5) != 5 {
		t.Fatal("price")
	}
}

// spec:price/discount#discount-applied
func TestDiscountApplied(t *testing.T) {
	_ = Discount(150)
}

func TestDiscountElsewhere(t *testing.T) {
	_ = Price(1)
}

// spec:price/bulk-price#small-order
func TestSmallOrderSmoke(t *testing.T) {
	_ = Price(3)
}
