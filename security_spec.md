# Security Specification for SIGA Zambrano

## Data Invariants
1. All documents must belong to the authenticated user (`user_id` matches `request.auth.uid`).
2. Users must have a verified email to write data (`request.auth.token.email_verified == true`).
3. Document IDs must be valid strings (`isValidId`).
4. Timestamps and amounts must be within reasonable ranges.
5. Critical fields like `user_id` are immutable.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing (Inventory)**: Attempt to create an inventory item with a different `user_id`.
2. **Identity Spoofing (Transaction)**: Attempt to create a transaction with a different `user_id`.
3. **Identity Spoofing (Debtor)**: Attempt to create a debtor with a different `user_id`.
4. **Privilege Escalation (Inventory)**: Attempt to update an inventory item belonging to another user.
5. **Privilege Escalation (Transaction)**: Attempt to update a transaction belonging to another user.
6. **Privilege Escalation (Debtor)**: Attempt to update a debtor belonging to another user.
7. **Resource Poisoning (ID)**: Attempt to create a document with a massive 1MB string as ID.
8. **Schema Violation (Inventory)**: Attempt to create an inventory item with a negative price.
9. **Schema Violation (Transaction)**: Attempt to create a transaction with an invalid type (not 'venta' or 'gasto').
10. **State Shortcutting (Debtor)**: Attempt to update a debtor's `debt` without including required fields or violating size limits in `payments`.
11. **Unverified Write**: Attempt to write data with an unverified email.
12. **Malicious Write (Batch)**: Attempt to perform a batch write that violates any of the above invariants.

## The Test Runner
(A separate test file would normally be here, but we will focus on generating the rules file).
