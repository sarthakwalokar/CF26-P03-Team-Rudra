# FlowGuard AI — 3-Minute Hackathon Demo Script

Follow this step-by-step walkthrough during the hackathon evaluation:

---

## Step 1: Policy Ingestion & Compilation (`/`)
1. Open the **Overview** dashboard (`http://localhost:5173/`).
2. Click the preset chip: **"Procurement Approval"** or type a custom natural-language enterprise policy.
3. Click **"Compile Policy to IR"**.
4. Observe the 6-stage compiler pipeline transform the policy into structured nodes, edges, preconditions, and failure policies.

## Step 2: 3-Column Interactive Graph & Verification (`/graph` and `/verify`)
1. Navigate to **Workflows Canvas** (`/graph`) to inspect the node cards, permissions, actors, and dependencies.
2. Navigate to **Verification Engine** (`/verify`) and click **"Run Verification"**.
3. Point out the **10 Deterministic Checks**, multidimensional security score breakdown (0–100), and specific findings.

## Step 3: Security Attack Lab (`/attack`)
1. Navigate to **Attack Lab** (`/attack`).
2. Run the **"Approval Bypass"** or **"Unauthorized Actor"** attack vector.
3. Show the real-time exploit path highlighted with glowing ruby lines and the corresponding vulnerability impact.

## Step 4: Auto-Repair Studio (`/repair`)
1. Navigate to **Auto-Repair** (`/repair`).
2. Click **"Generate Auto-Repair"** on an identified issue.
3. Inspect the visual **Before vs. After** diff:
   - Insertion of gating approval node.
   - Precondition rewiring.
   - Automatic formal re-verification score improvement ($34 \rightarrow 98$).
4. Click **"Apply Repair & Re-Verify"**.

## Step 5: 3D Digital Twin & Safe Execution (`/3d` and `/execute`)
1. Navigate to **3D Digital Twin** (`/3d`).
2. Switch between **Topology Twin**, **Live Telemetry**, and **Interactive Demo** showcasing the 4 deterministic states.
3. Navigate to **Execution Engine** (`/execute`) and demonstrate:
   - **Zero-Untrusted Gating**: Blocked workflows are strictly refused execution.
   - **Safe Execution**: Step-by-step state machine illumination with live latency telemetry.
4. Review the persistent **Audit Trail** (`/audit`).
