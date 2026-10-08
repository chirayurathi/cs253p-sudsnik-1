import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, cancel, driveTo, getOrder, place, steps, type Stack } from "../helpers.js";

let stack: Stack;
beforeEach(async () => {
  stack = await boot({ billing: false });
});
afterEach(() => stack.app.sudsnik.drain());

describe("customer cancel", () => {
  it("is 409 once the pod is washing, and changes nothing", async () => {
    const order = await driveTo(stack, await place(stack.app), "washing");
    const before = steps(stack.deps, order.orderId).length;
    const res = await cancel(stack.app, order.orderId);
    expect(res.statusCode).toBe(409);
    expect((await getOrder(stack.app, order.orderId)).state).toBe("washing");
    expect(steps(stack.deps, order.orderId)).toHaveLength(before);
  });
});
