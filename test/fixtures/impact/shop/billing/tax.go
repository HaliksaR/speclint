package billing

func Tax(total int) int {
	if total > 100 {
		return total / 5
	}
	return 0
}
