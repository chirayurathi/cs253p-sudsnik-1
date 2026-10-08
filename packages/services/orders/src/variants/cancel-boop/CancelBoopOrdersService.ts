import type { Ctx } from "@sudsnik/contracts";
import { CANCELLABLE_STATES, type Order } from "@sudsnik/contracts/services/orders";
import { err, ok, sudsnikError, type Result } from "@sudsnik/kernel";
import { COMPENSATION, ORIGIN, OrdersService, notFound } from "../../core/OrdersService.js";

/** Cancel on the customer's word, with its compensation (system-spec §9.3, ADR-0002). */
export class CancelBoopOrdersService extends OrdersService {
  async cancel(orderId: string, reason: string, ctx: Ctx): Promise<Result<Order>> {
    const outcome = this.inTransaction(() => {
      const order = this.find(ctx.tenantId, orderId);
      if (!order) return err(notFound(orderId));
      if (!CANCELLABLE_STATES.includes(order.state)) {
        return err(sudsnikError("CONFLICT", `order ${orderId} is ${order.state} and can no longer be cancelled`));
      }
      const compensations = this.cancelInPlace(order, reason, ORIGIN.customer, { correlationId: ctx.correlationId });
      return ok({ order, compensations });
    });
    if (!outcome.ok) return outcome;
    if (outcome.value.compensations.includes(COMPENSATION.refund)) await this.refundFor(outcome.value.order, ctx.correlationId);
    return this.get(orderId, ctx);
  }
}
