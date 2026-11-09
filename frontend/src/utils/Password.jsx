export const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character (e.g. @ # !)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

// Returns the list of rules the password does not meet (empty = valid)
export const validatePassword = (p) =>
  PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
