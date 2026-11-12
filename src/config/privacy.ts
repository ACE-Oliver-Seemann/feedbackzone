/**
 * Confidentiality threshold (NFR-02, MVP-11).
 *
 * This is the ONLY place where the value is defined. A round with fewer
 * responses than this exposes no averages, distributions or comments —
 * the API returns just `insufficient_responses` and the count.
 */
export const MIN_GROUP_SIZE = 5;
