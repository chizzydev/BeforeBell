import type {
  ActionResult,
} from "@/application/action-result";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import type {
  CoverageOffer,
} from "@/domain/types";

export type CoverageOfferResponse =
  | "accepted"
  | "declined";

export interface RespondToCoverageOfferInput {
  offerId: string;
  response: CoverageOfferResponse;

  now: Date;

  activityEventId: string;
  correlationId: string;
}

export interface RespondToCoverageOfferData {
  offer: CoverageOffer;
  idempotentReplay: boolean;
}

function responseMatchesOffer(
  offer: CoverageOffer,
  response: CoverageOfferResponse,
): boolean {
  return offer.status === response;
}

function isFinalCandidateResponse(
  offer: CoverageOffer,
): boolean {
  return (
    offer.status === "accepted" ||
    offer.status === "declined"
  );
}

export async function respondToCoverageOffer(
  store: BeforeBellStore,
  input: RespondToCoverageOfferInput,
): Promise<ActionResult<RespondToCoverageOfferData>> {
  const offer = await store.getOffer(
    input.offerId,
  );

  if (!offer) {
    return {
      success: false,
      code: "offer_not_found",
      message: "Coverage offer was not found.",
      retryable: false,
    };
  }

  /**
   * An exact replay of an already-recorded response is an idempotent
   * success, even if wall-clock time has advanced since the original
   * response.
   */
  if (
    responseMatchesOffer(
      offer,
      input.response,
    )
  ) {
    return {
      success: true,
      code: "offer_response_already_recorded",
      message:
        "This candidate response was already recorded.",
      retryable: false,
      data: {
        offer,
        idempotentReplay: true,
      },
    };
  }

  if (isFinalCandidateResponse(offer)) {
    return {
      success: false,
      code: "offer_already_responded",
      message: `This offer was already ${offer.status}.`,
      retryable: false,
    };
  }

  if (
    offer.status === "expired" ||
    offer.status === "cancelled"
  ) {
    return {
      success: false,
      code: "offer_not_respondable",
      message: `An offer in status "${offer.status}" cannot receive a candidate response.`,
      retryable: false,
    };
  }

  if (
    new Date(offer.expiresAt).getTime() <=
    input.now.getTime()
  ) {
    return {
      success: false,
      code: "offer_expired",
      message:
        "The coverage offer expired before this response was received.",
      retryable: false,
    };
  }

  const absenceCase = await store.getCase(
    offer.caseId,
  );

  if (!absenceCase) {
    return {
      success: false,
      code: "case_not_found",
      message:
        "The coverage case associated with this offer was not found.",
      retryable: false,
    };
  }

  if (
    absenceCase.status === "resolved" ||
    absenceCase.status === "closed"
  ) {
    return {
      success: false,
      code: "case_not_actionable",
      message: `Candidate responses cannot be applied to a case in status "${absenceCase.status}".`,
      retryable: false,
    };
  }

  const updatedOffer: CoverageOffer = {
    ...offer,
    status: input.response,
    respondedAt: input.now.toISOString(),
  };

  const updated =
    await store.updateOfferIfStatus(
      offer.id,
      "pending",
      updatedOffer,
    );

  if (!updated) {
    /**
     * Another invocation may have changed the offer after our initial
     * read. Reload authoritative state and reconcile the race.
     */
    const currentOffer =
      await store.getOffer(offer.id);

    if (!currentOffer) {
      return {
        success: false,
        code: "offer_not_found",
        message:
          "The coverage offer no longer exists.",
        retryable: false,
      };
    }

    if (
      responseMatchesOffer(
        currentOffer,
        input.response,
      )
    ) {
      return {
        success: true,
        code: "offer_response_already_recorded",
        message:
          "This candidate response was already recorded.",
        retryable: false,
        data: {
          offer: currentOffer,
          idempotentReplay: true,
        },
      };
    }

    if (isFinalCandidateResponse(currentOffer)) {
      return {
        success: false,
        code: "offer_already_responded",
        message: `This offer was already ${currentOffer.status}.`,
        retryable: false,
      };
    }

    return {
      success: false,
      code: "offer_state_changed",
      message:
        "The offer changed before the response could be recorded.",
      retryable: false,
    };
  }

  await store.appendActivity({
    eventId: input.activityEventId,
    caseId: absenceCase.id,
    timestamp: input.now.toISOString(),
    actorType: "candidate",
    action:
      input.response === "accepted"
        ? "coverage_offer_accepted"
        : "coverage_offer_declined",
    status: "succeeded",
    summary:
      input.response === "accepted"
        ? `Coverage offer accepted for ${offer.periodIds.join(", ")}.`
        : `Coverage offer declined for ${offer.periodIds.join(", ")}.`,
    correlationId: input.correlationId,
  });

  return {
    success: true,
    code: "offer_response_recorded",
    message: `Coverage offer ${input.response}.`,
    retryable: false,
    data: {
      offer: updatedOffer,
      idempotentReplay: false,
    },
  };
}