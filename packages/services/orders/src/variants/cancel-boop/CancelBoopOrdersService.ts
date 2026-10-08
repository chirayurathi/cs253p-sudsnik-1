import type { Ctx } from "@sudsnik/contracts";
import { CANCELLABLE_STATES, type Order } from "@sudsnik/contracts/services/orders";
import { err, sudsnikError, type Result } from "@sudsnik/kernel";
import { OrdersService } from "../../core/OrdersService.js";

/** Cancel on the customer's word, with its compensation (system-spec §9.3, ADR-0002). */
export class CancelBoopOrdersService extends OrdersService {
  async cancel(orderId: string, _reason: string, ctx: Ctx): Promise<Result<Order>> {
    const found = await this.get(orderId, ctx);
    if (!found.ok) return found;
    const order = found.value;
    if (!CANCELLABLE_STATES.includes(order.state)) {
      return err(sudsnikError("CONFLICT", `order ${orderId} is ${order.state} and can no longer be cancelled`));
    }
    return found;
  }
}
