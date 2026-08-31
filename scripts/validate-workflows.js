// ─── Workflow JSON Validation Script ───
// Run: node scripts/validate-workflows.js

const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'src', 'data', 'workflows');
const SKILLS_DIR = path.join(__dirname, '..', 'pm-skills');

const REQUIRED_TOP_FIELDS = ['id', 'name', 'emoji', 'shortDesc', 'description', 'skills', 'phases', 'outputs', 'estimatedTime', 'triggerScenarios'];
const REQUIRED_PHASE_FIELDS = ['id', 'title', 'description', 'skills', 'guidance'];

let errors = [];
let warnings = [];

function logError(file, msg) {
  errors.push(`[ERROR] ${file}: ${msg}`);
}
function logWarn(file, msg) {
  warnings.push(`[WARN] ${file}: ${msg}`);
}

// Get all valid skill directories
const validSkills = new Set(
  fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
);

const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));

console.log(`\n🔍 Validating ${files.length} workflow JSONs...\n`);

for (const file of files) {
  const filePath = path.join(WORKFLOWS_DIR, file);
  const displayName = file.replace('.json', '');

  // 1. Parse JSON
  let wf;
  try {
    wf = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    logError(file, `Invalid JSON: ${e.message}`);
    continue;
  }

  // 2. Check required top-level fields
  for (const field of REQUIRED_TOP_FIELDS) {
    if (!(field in wf)) {
      logError(file, `Missing required field: "${field}"`);
    }
  }

  // 3. Validate id matches filename
  if (wf.id !== displayName) {
    logError(file, `id "${wf.id}" does not match filename "${displayName}"`);
  }

  // 4. Validate skills is an array
  if (!Array.isArray(wf.skills)) {
    logError(file, 'skills must be an array');
  }

  // 5. Validate phases is a non-empty array
  if (!Array.isArray(wf.phases) || wf.phases.length === 0) {
    logError(file, 'phases must be a non-empty array');
    continue;
  }

  // 6. Validate each phase
  const phaseIds = new Set();
  const allPhaseSkills = new Set();
  for (let i = 0; i < wf.phases.length; i++) {
    const phase = wf.phases[i];
    const phaseLabel = `phase[${i}] (${phase.id || '?'})`;

    for (const field of REQUIRED_PHASE_FIELDS) {
      if (!(field in phase)) {
        logError(file, `${phaseLabel}: missing required field "${field}"`);
      }
    }

    // Check phase id uniqueness
    if (phase.id) {
      if (phaseIds.has(phase.id)) {
        logError(file, `${phaseLabel}: duplicate phase id "${phase.id}"`);
      }
      phaseIds.add(phase.id);
    }

    // Check phase skills
    if (Array.isArray(phase.skills)) {
      for (const skill of phase.skills) {
        if (typeof skill !== 'string') {
          logError(file, `${phaseLabel}: skill "${skill}" is not a string`);
          continue;
        }
        allPhaseSkills.add(skill);

        // Check skill exists in pm-skills/
        if (!validSkills.has(skill)) {
          logError(file, `${phaseLabel}: skill "${skill}" does NOT exist in pm-skills/`);
        }
      }
    }
  }

  // 7. Check top-level skills completeness — all skills in the top-level array should be used
  if (Array.isArray(wf.skills)) {
    for (const skill of wf.skills) {
      if (!validSkills.has(skill)) {
        logError(file, `top-level skill "${skill}" does NOT exist in pm-skills/`);
      }
      if (!allPhaseSkills.has(skill)) {
        logWarn(file, `top-level skill "${skill}" is never used in any phase`);
      }
    }
    // Check for orphan phase skills
    for (const skill of allPhaseSkills) {
      if (!wf.skills.includes(skill)) {
        logWarn(file, `phase skill "${skill}" is NOT declared in top-level skills array`);
      }
    }
  }

  // 8. Check outputs
  if (!Array.isArray(wf.outputs) || wf.outputs.length === 0) {
    logError(file, 'outputs must be a non-empty array');
  }

  // 9. Check estimatedTime format
  if (wf.estimatedTime && !/\d+-\d+\s*min/.test(wf.estimatedTime)) {
    logWarn(file, `estimatedTime "${wf.estimatedTime}" format is unusual (expected "X-Y min")`);
  }

  // 10. Check triggerScenarios
  if (!Array.isArray(wf.triggerScenarios) || wf.triggerScenarios.length === 0) {
    logError(file, 'triggerScenarios must be a non-empty array');
  }

  // 11. Check for empty description
  if (wf.description && wf.description.length < 20) {
    logWarn(file, 'description seems too short');
  }

  // 12. Check emoji is a single character
  if (wf.emoji && wf.emoji.length > 4) {
    logWarn(file, `emoji "${wf.emoji}" seems too long (expected single emoji)`);
  }
}

// ─── Cross-workflow checks ───
console.log('🔍 Cross-workflow checks...\n');

const allWorkflows = files.map(f => {
  const wf = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf-8'));
  return { file: f, ...wf };
});

// Check for duplicate IDs
const ids = new Set();
for (const wf of allWorkflows) {
  if (ids.has(wf.id)) {
    logError(wf.file, `duplicate workflow id "${wf.id}"`);
  }
  ids.add(wf.id);
}

// Check for duplicate names
const names = new Map();
for (const wf of allWorkflows) {
  if (names.has(wf.name)) {
    logWarn(wf.file, `duplicate workflow name "${wf.name}" (also in ${names.get(wf.name)})`);
  }
  names.set(wf.name, wf.file);
}

// Count all referenced skills
const allRefSkills = new Set();
for (const wf of allWorkflows) {
  for (const s of (wf.skills || [])) allRefSkills.add(s);
}
console.log(`   Total unique skills referenced: ${allRefSkills.size}`);
console.log(`   Total skills available in pm-skills/: ${validSkills.size}`);

// Skills in pm-skills/ but never referenced by any workflow
const unusedSkills = [...validSkills].filter(s => !allRefSkills.has(s));
if (unusedSkills.length > 0) {
  console.log(`   ⚠️  ${unusedSkills.length} skills in pm-skills/ are never used by any workflow:`);
  unusedSkills.forEach(s => console.log(`      - ${s}`));
}

// ─── Report ───
console.log(`\n${'='.repeat(60)}`);
console.log('📊 VALIDATION REPORT');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All 10 workflows passed validation! No errors or warnings.');
} else {
  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} ERROR(S):`);
    errors.forEach(e => console.log(`   ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} WARNING(S):`);
    warnings.forEach(w => console.log(`   ${w}`));
  }
}

console.log(`\nFiles checked: ${files.length}`);
console.log(`Errors: ${errors.length} | Warnings: ${warnings.length}`);

// Exit with error code if there are errors
process.exit(errors.length > 0 ? 1 : 0);