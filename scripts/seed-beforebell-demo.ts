import {
  config as loadEnvironment,
} from "dotenv";

import {
  BEFOREBELL_DEMO_CASES,
} from "../src/demo/beforebell-demo";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
  scenarioBAbsence,
  scenarioBCandidates,
  scenarioCAbsence,
  scenarioCCandidates,
} from "../src/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
} from "../src/domain/types";

import {
  createBeforeBellDynamoClients,
} from "../src/infrastructure/dynamodb/client";

import {
  DynamoDbBeforeBellStore,
} from "../src/infrastructure/dynamodb/dynamodb-beforebell-store";

import {
  getBeforeBellDynamoConfig,
} from "../src/infrastructure/dynamodb/env";


loadEnvironment({
  path:
    ".env.local",
});


const EXPECTED_TABLE =
  "beforebell-dev";

const EXPECTED_REGION =
  "us-east-1";


function assert(
  condition:
    unknown,
  message:
    string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}


function getDefinition(
  scenario:
    "A" | "B" | "C",
) {
  const definition =
    BEFOREBELL_DEMO_CASES.find(
      (
        item,
      ) =>
        item.scenario ===
        scenario,
    );

  assert(
    definition,
    `Demo definition ${scenario} is missing.`,
  );

  return definition;
}


function remapCandidates(
  candidates:
    readonly CoverageCandidate[],
  scenario:
    "a" | "b" | "c",
  schoolId:
    string,
): CoverageCandidate[] {
  return candidates.map(
    (
      candidate,
    ) => ({
      ...candidate,

      id:
        `${candidate.id}-demo-${scenario}`,

      schoolId,
    }),
  );
}


async function main() {
  const config =
    getBeforeBellDynamoConfig();

  assert(
    config.tableName ===
      EXPECTED_TABLE,
    `Refusing to seed "${config.tableName}". Expected "${EXPECTED_TABLE}".`,
  );

  assert(
    config.region ===
      EXPECTED_REGION,
    `Refusing to seed region "${config.region}". Expected "${EXPECTED_REGION}".`,
  );


  const {
    serviceClient,
    documentClient,
  } =
    createBeforeBellDynamoClients(
      config,
    );

  const store =
    new DynamoDbBeforeBellStore({
      documentClient,

      tableName:
        config.tableName,
    });


  const a =
    getDefinition(
      "A",
    );

  const b =
    getDefinition(
      "B",
    );

  const c =
    getDefinition(
      "C",
    );


  const candidatesA =
    remapCandidates(
      scenarioACandidates,
      "a",
      a.schoolId,
    );

  const candidatesB =
    remapCandidates(
      scenarioBCandidates,
      "b",
      b.schoolId,
    );

  const candidatesC =
    remapCandidates(
      scenarioCCandidates,
      "c",
      c.schoolId,
    );


  const alex =
    candidatesA.find(
      (
        candidate,
      ) =>
        candidate.name ===
        "Alex Johnson",
    );

  const jordan =
    candidatesB.find(
      (
        candidate,
      ) =>
        candidate.name ===
        "Jordan Lee",
    );


  assert(
    alex,
    "Scenario A demo candidate Alex Johnson is missing.",
  );

  assert(
    jordan,
    "Scenario B demo candidate Jordan Lee is missing.",
  );


  const caseAOpen:
    AbsenceCase = {
      ...scenarioAAbsence,

      id:
        a.caseId,

      schoolId:
        a.schoolId,

      absentStaffMemberId:
        "staff-sarah-miller-demo",

      status:
        "open",

      updatedAt:
        "2026-09-14T06:00:00.000Z",
    };


  const caseAResolved:
    AbsenceCase = {
      ...caseAOpen,

      status:
        "resolved",

      updatedAt:
        "2026-09-14T06:06:00.000Z",
    };


  const caseB:
    AbsenceCase = {
      ...scenarioBAbsence,

      id:
        b.caseId,

      schoolId:
        b.schoolId,

      absentStaffMemberId:
        "staff-daniel-reed-demo",

      status:
        "partially_covered",

      updatedAt:
        "2026-09-14T06:04:00.000Z",
    };


  const caseC:
    AbsenceCase = {
      ...scenarioCAbsence,

      id:
        c.caseId,

      schoolId:
        c.schoolId,

      absentStaffMemberId:
        "staff-olivia-chen-demo",

      status:
        "open",

      updatedAt:
        "2026-09-14T06:02:00.000Z",
    };


  const offerA:
    CoverageOffer = {
      id:
        "offer-beforebell-demo-a-alex",

      caseId:
        a.caseId,

      candidateId:
        alex.id,

      periodIds: [
        "P1",
        "P2",
        "P4",
        "P6",
      ],

      status:
        "accepted",

      createdAt:
        "2026-09-14T05:58:00.000Z",

      expiresAt:
        "2026-09-14T06:30:00.000Z",

      respondedAt:
        "2026-09-14T06:02:00.000Z",
    };


  const assignmentA:
    CoverageAssignment = {
      id:
        "assignment-beforebell-demo-a-alex",

      caseId:
        a.caseId,

      candidateId:
        alex.id,

      periodIds: [
        "P1",
        "P2",
        "P4",
        "P6",
      ],

      source:
        "accepted_offer",

      offerId:
        offerA.id,

      createdAt:
        "2026-09-14T06:06:00.000Z",
    };


  const offerB:
    CoverageOffer = {
      id:
        "offer-beforebell-demo-b-jordan",

      caseId:
        b.caseId,

      candidateId:
        jordan.id,

      periodIds: [
        "P2",
        "P3",
      ],

      status:
        "accepted",

      createdAt:
        "2026-09-14T05:55:00.000Z",

      expiresAt:
        "2026-09-14T06:30:00.000Z",

      respondedAt:
        "2026-09-14T06:00:00.000Z",
    };


  const assignmentB:
    CoverageAssignment = {
      id:
        "assignment-beforebell-demo-b-jordan",

      caseId:
        b.caseId,

      candidateId:
        jordan.id,

      periodIds: [
        "P2",
        "P3",
      ],

      source:
        "accepted_offer",

      offerId:
        offerB.id,

      createdAt:
        "2026-09-14T06:03:00.000Z",
    };


  console.log(
    "\n=== BeforeBell persistent demo seed ===\n",
  );

  console.log(
    `Region: ${config.region}`,
  );

  console.log(
    `Table:  ${config.tableName}`,
  );


  try {
    for (
      const [
        definition,
        candidates,
      ] of [
        [
          a,
          candidatesA,
        ],
        [
          b,
          candidatesB,
        ],
        [
          c,
          candidatesC,
        ],
      ] as const
    ) {
      await store.putPolicy({
        ...riversideCoveragePolicy,

        schoolId:
          definition.schoolId,
      });

      for (
        const candidate of
        candidates
      ) {
        await store.putCandidate(
          candidate,
        );
      }
    }


    console.log(
      "\nScenario A — resolved routine coverage...",
    );

    await store.putCase(
      caseAOpen,
    );

    await store.putOffer(
      offerA,
    );

    await store.putAssignment(
      assignmentA,
    );

    await store.putCase(
      caseAResolved,
    );

    console.log(
      "Scenario A seeded: PASS ✅",
    );


    console.log(
      "\nScenario B — P2/P3 covered, P5 left for judgment...",
    );

    await store.putCase(
      caseB,
    );

    await store.putOffer(
      offerB,
    );

    await store.putAssignment(
      assignmentB,
    );

    console.log(
      "Scenario B seeded: PASS ✅",
    );


    console.log(
      "\nScenario C — routine coordination ready...",
    );

    await store.putCase(
      caseC,
    );

    console.log(
      "Scenario C seeded: PASS ✅",
    );


    const [
      storedA,
      storedB,
      storedC,
      assignmentsA,
      assignmentsB,
    ] =
      await Promise.all([
        store.getCase(
          a.caseId,
        ),

        store.getCase(
          b.caseId,
        ),

        store.getCase(
          c.caseId,
        ),

        store.listAssignmentsByCase(
          a.caseId,
        ),

        store.listAssignmentsByCase(
          b.caseId,
        ),
      ]);


    assert(
      storedA?.status ===
        "resolved",
      "Scenario A did not persist as resolved.",
    );

    assert(
      storedB?.status ===
        "partially_covered",
      "Scenario B did not persist as partially covered.",
    );

    assert(
      storedC?.status ===
        "open",
      "Scenario C did not persist as open.",
    );

    assert(
      assignmentsA.length ===
        1,
      `Expected one Scenario A assignment; found ${assignmentsA.length}.`,
    );

    assert(
      assignmentsB.length ===
        1,
      `Expected one Scenario B assignment; found ${assignmentsB.length}.`,
    );


    console.log(
      "\n=== BEFOREBELL DEMO SEED PASS ===\n",
    );

    console.log(
      `${a.caseId}: resolved`,
    );

    console.log(
      `${b.caseId}: partially_covered`,
    );

    console.log(
      `${c.caseId}: open`,
    );

    console.log(
      "\nPersistent demo foundation is ready. ✅",
    );
  } finally {
    serviceClient.destroy();
  }
}


main().catch(
  (
    error,
  ) => {
    console.error(
      "\nBeforeBell demo seed failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);