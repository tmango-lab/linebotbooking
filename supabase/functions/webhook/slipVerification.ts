
/**
 * Mock Slip Verification
 * In Phase 1, we assume any slip sent for a 200 THB deposit is valid.
 */
export async function verifySlip(imageBytes: Uint8Array, expectedAmount: number = 200): Promise<{ success: boolean; message: string }> {
    console.log(`[Slip Verification] Mocking verification for ${expectedAmount} THB slip.`);

    // In a real implementation, this would call an OCR or Slip Verification API
    // and verify the amount, recipient (PromptPay), and date.

    return {
        success: true,
        message: "Successfully verified (Mock)"
    };
}
