import assert from "node:assert/strict";
import test from "node:test";
import {
  createTicketSchema,
  listTicketsSchema,
  updateTicketSchema,
} from "./ticket.schemas.js";

test("ticket creation trims valid input", () => {
  const result = createTicketSchema.parse({
    subject: "  Cannot access billing page  ",
    description: "  The billing page returns an error after sign in.  ",
  });

  assert.equal(result.subject, "Cannot access billing page");
  assert.equal(
    result.description,
    "The billing page returns an error after sign in.",
  );
});

test("empty ticket update is rejected", () => {
  assert.equal(updateTicketSchema.safeParse({}).success, false);
});

test("ticket list page size cannot exceed 100", () => {
  assert.equal(
    listTicketsSchema.safeParse({
      page: 1,
      limit: 101,
    }).success,
    false,
  );
});
