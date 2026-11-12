const { ApiError } = require("./supabase");
// Contracts for later, provider-approved integrations. Environment flags alone cannot enable payments.
class DisabledMobileMoney {
  constructor(provider) {
    this.provider = provider;
    this.enabled = false;
  }
  async initiate() {
    throw new ApiError(503, "Mobile money is not activated.");
  }
  async verifyWebhook() {
    throw new ApiError(503, "Verified provider webhooks are not configured.");
  }
  async refund() {
    throw new ApiError(503, "Provider refunds are not activated.");
  }
}
module.exports = {
  providers: {
    airtel_money: new DisabledMobileMoney("airtel_money"),
    moov_money: new DisabledMobileMoney("moov_money"),
  },
};
