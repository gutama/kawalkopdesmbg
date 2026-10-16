CREATE TRIGGER `proof_of_delivery_immutable`
BEFORE UPDATE ON `proof_of_delivery`
FOR EACH ROW
BEGIN
	SELECT RAISE(ABORT, 'proof_of_delivery records are immutable');
END;