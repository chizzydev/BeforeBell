import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCoverageOfferTool,
} from "@/agent/tools/create-coverage-offer";

import {
  InMemoryBeforeBellStore,
} from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

function createStore() {
  return new InMemoryBeforeBellStore({
    policies: [
      riversideCoveragePolicy,
    ],

    cases: [
      scenarioAAbsence,
    ],

    candidates:
      scenarioACandidates,
  });
}

describe("createCoverageOfferTool", () => {
  it("creates an offer only for the authoritative Scenario A proposal", async () => {
    const store =
      createStore();

    const tool =
      createCoverageOfferTool(
        store,
        {
          now: () =>
            new Date(
              "2026-09-14T05:55:00.000Z",
            ),

          offerTtlMinutes: 20,
        },
      );

    const result =
      await tool.invoke({
        caseId:
          scenarioAAbsence.id,

        candidateId:
          "candidate-alex-johnson",

        periodIds: [
          "P1",
          "P2",
          "P4",
          "P6",
        ],
      });

    expect(result.success).toBe(
      true,
    );

    expect(result.code).toBe(
      "offer_created",
    );

    expect(
      result.data?.caseStatus,
    ).toBe("offering");

    expect(
      result.data?.caseStatusChanged,
    ).toBe(true);

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("offering");

    const offers =
      await store.listOffersByCase(
        scenarioAAbsence.id,
      );

    expect(offers).toHaveLength(
      1,
    );

    expect(offers[0]).toMatchObject({
      caseId:
        scenarioAAbsence.id,

      candidateId:
        "candidate-alex-johnson",

      periodIds: [
        "P1",
        "P2",
        "P4",
        "P6",
      ],

      status: "pending",

      createdAt:
        "2026-09-14T05:55:00.000Z",

      expiresAt:
        "2026-09-14T06:15:00.000Z",
    });

    const activity =
      await store.listActivityByCase(
        scenarioAAbsence.id,
      );

    expect(
      activity.map(
        (event) =>
          event.action,
      ),
    ).toEqual([
      "coverage_offer_created",
      "coverage_case_status_updated",
    ]);
  });

  it("rejects a model-selected candidate that does not match the current planner proposal", async () => {
    const store =
      createStore();

    const tool =
      createCoverageOfferTool(
        store,
        {
          now: () =>
            new Date(
              "2026-09-14T05:55:00.000Z",
            ),
        },
      );

    const result =
      await tool.invoke({
        caseId:
          scenarioAAbsence.id,

        candidateId:
          "candidate-maria-patel",

        periodIds: [
          "P2",
          "P4",
          "P6",
        ],
      });

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "proposal_not_authoritative",
    );

    expect(
      await store.listOffersByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("open");

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });

  it("replays the same logical offer idempotently even when wall-clock time advances", async () => {
    const store =
      createStore();

    let currentTime =
      new Date(
        "2026-09-14T05:55:00.000Z",
      );

    const tool =
      createCoverageOfferTool(
        store,
        {
          now: () =>
            currentTime,

          offerTtlMinutes: 20,
        },
      );

    const input: Parameters<
      typeof tool.invoke
    >[0] = {
      caseId:
        scenarioAAbsence.id,

      candidateId:
        "candidate-alex-johnson",

      periodIds: [
        "P1",
        "P2",
        "P4",
        "P6",
      ],
    };

    const first =
      await tool.invoke(input);

    expect(first.success).toBe(
      true,
    );

    expect(first.code).toBe(
      "offer_created",
    );

    expect(
      first.data?.caseStatus,
    ).toBe("offering");

    expect(
      first.data?.caseStatusChanged,
    ).toBe(true);

    currentTime =
      new Date(
        "2026-09-14T06:00:00.000Z",
      );

    const replay =
      await tool.invoke(input);

    expect(replay.success).toBe(
      true,
    );

    expect(replay.code).toBe(
      "offer_already_created",
    );

    expect(
      replay.data?.idempotentReplay,
    ).toBe(true);

    expect(
      replay.data?.caseStatus,
    ).toBe("offering");

    expect(
      replay.data?.caseStatusChanged,
    ).toBe(false);

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("offering");

    const offers =
      await store.listOffersByCase(
        scenarioAAbsence.id,
      );

    expect(offers).toHaveLength(
      1,
    );

    expect(
      offers[0]?.expiresAt,
    ).toBe(
      "2026-09-14T06:15:00.000Z",
    );

    const activity =
      await store.listActivityByCase(
        scenarioAAbsence.id,
      );

    expect(activity).toHaveLength(
      2,
    );

    expect(
      activity.map(
        (event) =>
          event.action,
      ),
    ).toEqual([
      "coverage_offer_created",
      "coverage_case_status_updated",
    ]);
  });
});