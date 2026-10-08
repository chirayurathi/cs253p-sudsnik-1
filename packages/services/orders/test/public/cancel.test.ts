import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, cancel, driveTo, fakeBilling, getOrder, place, steps, type Stack } from "../helpers.js";

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

    it("cancels a paid order, records the cancel, then refunds, and tells the bus", async () => {
    await stack.app.sudsnik.drain();
    stack = await boot();
    const billing = fakeBilling(stack.deps);
    const order = await place(stack.app);
    await new Promise((r) => setImmediate(r));
    const res = await cancel(stack.app, order.orderId, "crew changed their mind");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ state: "cancelled", payment: "refunded" });
    expect(billing.refunds).toBe(1);
    expect(steps(stack.deps, order.orderId).map((s) => s.step)).toEqual(["place", "authorize", "cancel", "refund"]);
    await stack.app.sudsnik.drain();
    expect(stack.deps.bus.published.map((e) => e.topic)).toEqual(["order.placed", "order.cancelled"]);
    stack = await boot({ billing: false });
  });

});
