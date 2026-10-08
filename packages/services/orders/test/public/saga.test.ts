import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, cancel, deliver, driveTo, fakeBilling, getOrder, place, steps, type Stack } from "../helpers.js";

let stack: Stack;
beforeEach(async () => {
  stack = await boot({ billing: false });
});
afterEach(() => stack.app.sudsnik.drain());

describe("order saga, as it is today", () => {
  it("walks the happy path from placed to returned", async () => {
    const order = await driveTo(stack, await place(stack.app), "returned");
    expect(order.state).toBe("returned");
    expect(steps(stack.deps, order.orderId).map((s) => s.step)).toEqual([
      "place",
      "pickup.scheduled",
      "pod.collected",
      "pod.delivered",
      "wash.started",
      "wash.completed",
      "return.scheduled",
      "pod.returned",
    ]);
  });

  it("cancels the order itself when dispatch gives up on the pickup", async () => {
    const order = await place(stack.app);
    await deliver(stack.deps, "pickup.failed", {
      orderId: order.orderId,
      podId: order.podId,
      habitatId: order.habitatId,
      reason: "no shuttle",
      attempts: 3,
    });
    expect((await getOrder(stack.app, order.orderId)).state).toBe("cancelled");
    expect(steps(stack.deps, order.orderId).map((s) => s.step)).toEqual(["place", "pickup.failed", "cancel"]);
    await stack.app.sudsnik.drain();
    expect(stack.deps.bus.published.map((e) => e.topic)).toEqual(["order.placed", "order.cancelled"]);
    stack = await boot({ billing: false });
  });

    it("refunds after it records the cancel when dispatch gives up on a paid order", async () => {
    await stack.app.sudsnik.drain();
    stack = await boot();
    const billing = fakeBilling(stack.deps);
    const order = await place(stack.app);
    await new Promise((r) => setImmediate(r));
    await deliver(stack.deps, "pickup.failed", {
      orderId: order.orderId,
      podId: order.podId,
      habitatId: order.habitatId,
      reason: "no shuttle",
      attempts: 3,
    });
    const after = await getOrder(stack.app, order.orderId);
    expect(after.state).toBe("cancelled");
    expect(after.payment).toBe("refunded");
    expect(billing.refunds).toBe(1);
    expect(steps(stack.deps, order.orderId).map((s) => s.step)).toEqual([
      "place",
      "authorize",
      "pickup.failed",
      "cancel",
      "refund",
    ]);  });

      it("answers 200 to a customer cancel and changes nothing (cancel-noop, issue #859)", async () => {
    await stack.app.sudsnik.drain();
    stack = await boot();
    const billing = fakeBilling(stack.deps);
    const order = await place(stack.app);
    await new Promise((r) => setImmediate(r));
    const res = await cancel(stack.app, order.orderId);
    expect(res.statusCode).toBe(200);
    const after = await getOrder(stack.app, order.orderId);
    expect(after.state).toBe("placed");
    expect(after.payment).toBe("authorized");
    expect(billing.refunds).toBe(0);
    expect(steps(stack.deps, order.orderId).map((s) => s.step)).toEqual(["place", "authorize"]);
    await stack.app.sudsnik.drain();
    expect(stack.deps.bus.published.map((e) => e.topic)).toEqual(["order.placed"]);
    stack = await boot({ billing: false });
  });

});
