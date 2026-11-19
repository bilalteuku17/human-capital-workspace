const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-hcw-key"
  }
});

const AI_MODEL = "@cf/zai-org/glm-4.7-flash";

const AGENT_PROFILES = {
  1: { name: "HC Strategy & PMO", mandate: "Menerjemahkan arahan CEO menjadi prioritas, roadmap, business brief, opsi keputusan, dan koordinasi lintas fungsi Human Capital.", expertise: "Strategi HC, perencanaan program, tata kelola proyek, business case, executive reporting, dan manajemen risiko." },
  2: { name: "Organization Development & Workforce", mandate: "Merancang organisasi, struktur dan jabatan, job description, kompetensi, proses kerja, SOP, serta analisis beban kerja dan kebutuhan manpower.", expertise: "Organization design, job architecture, competency management, WLA/FTE, workforce planning, process improvement, dan produktivitas organisasi." },
  3: { name: "Talent Acquisition", mandate: "Menyusun strategi pemenuhan tenaga kerja dari requisition sampai seleksi, termasuk prioritas hiring, sourcing, interview, dan monitoring pipeline.", expertise: "Manpower requisition, recruitment funnel, sourcing, selection, interview guide, hiring plan, recruitment SLA, dan recruitment analytics." },
  4: { name: "Talent Management & Succession", mandate: "Menyusun pendekatan pengelolaan talenta, talent review, succession, career path, IDP, dan pengembangan pipeline pemimpin.", expertise: "Talent mapping, performance-potential review, succession planning, career management, IDP, retention, dan leadership development." },
  5: { name: "Learning & Development", mandate: "Menyusun kebutuhan dan solusi pembelajaran yang relevan dengan pekerjaan, standar kompetensi, dan dampak bisnis.", expertise: "TNA, learning curriculum, training design, OJT, coaching, mentoring, learning evaluation, LMS, dan learning analytics." },
  6: { name: "Performance Management", mandate: "Membangun sistem sasaran dan pengukuran kinerja yang terhubung dengan prioritas bisnis, termasuk KPI, appraisal, dan tindak lanjut kinerja.", expertise: "KPI cascading, scorecard, target setting, weighting, performance appraisal, calibration, performance improvement, dan governance." },
  7: { name: "HRIS & Process Automation", mandate: "Menerjemahkan kebutuhan proses HC menjadi spesifikasi sistem, workflow, model data, integrasi, dan otomasi yang aman serta dapat dipelihara.", expertise: "HRIS requirements, process mapping, workflow design, data governance, access control, Google Workspace automation, API integration, dan system documentation." },
  8: { name: "People Analytics & Engagement", mandate: "Mengolah data tenaga kerja dan masukan karyawan menjadi insight, dashboard, prioritas engagement, serta rekomendasi perbaikan pengalaman karyawan.", expertise: "People analytics, workforce dashboard, headcount, productivity, engagement survey, attrition analysis, employee experience, dan employer branding metrics." }
};

const DEFAULT_AGENT = {
  name: "Koordinator HC Lintas Fungsi",
  mandate: "Menyusun output terintegrasi lintas fungsi Human Capital, mengidentifikasi kontribusi fungsi yang relevan, dan menyajikan rekomendasi konsolidasi kepada CEO.",
  expertise: "HC strategy, cross-functional coordination, prioritization, executive synthesis, and risk review."
};

function getAgentProfile(ownerId) {
  return ownerId == null ? DEFAULT_AGENT : (AGENT_PROFILES[ownerId] || DEFAULT_AGENT);
}

function authorized(request, env) {
  const configured = env.HCW_API_KEY;
  return Boolean(configured && request.headers.get("x-hcw-key") === configured);
}

function taskSelectSql() {
  return "SELECT id, title, description, owner_id, status, result, error, ai_model, attempt_count, started_at, completed_at, created_at, updated_at FROM tasks";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,x-hcw-key",
        "access-control-max-age": "86400"
      }});
    }

    if (url.pathname === "/health" && request.method === "GET") {
      let database = "not_connected";
      try {
        if (env.DB) {
          const schema = await env.DB.prepare(
            "SELECT id, result, error, ai_model, attempt_count, started_at, completed_at FROM tasks LIMIT 0"
          ).all();
          database = schema ? "connected" : "schema_missing";
        }
      } catch {
        database = "error";
      }
      return json({
        service: "HUMAN CAPITAL WORKSPACE",
        status: "online",
        api_version: "0.3.0",
        database,
        api_auth: env.HCW_API_KEY ? "configured" : "not_configured",
        ai_engine: env.AI ? "binding_ready" : "not_configured",
        ai_model: env.AI ? AI_MODEL : null,
        agent_profiles: Object.keys(AGENT_PROFILES).length,
        ai_task_mode: "role_based_per_task",
        note: "Workers AI binding is available; model inference has not yet been smoke-tested. Task execution requires API authentication."
      });
    }

    if (url.pathname.startsWith("/api/") && !authorized(request, env)) {
      return json({ error: "Unauthorized", message: "A valid HCW API key is required." }, 401);
    }

    if (!env.DB && url.pathname.startsWith("/api/")) {
      return json({ error: "D1 binding DB is unavailable." }, 503);
    }

    if (url.pathname === "/api/tasks" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        taskSelectSql() + " ORDER BY created_at DESC LIMIT 100"
      ).all();
      return json({ tasks: results || [] });
    }

    if (url.pathname === "/api/tasks" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const ownerId = body.owner_id == null || body.owner_id === "" ? null : Number(body.owner_id);
      if (!title || !description) return json({ error: "title and description are required." }, 400);
      if (title.length > 180 || description.length > 12000) return json({ error: "Input exceeds allowed length." }, 400);
      if (ownerId !== null && (!Number.isInteger(ownerId) || ownerId < 1 || ownerId > 8)) return json({ error: "owner_id must be an integer from 1 to 8, or null for the cross-functional coordinator." }, 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO tasks (id, title, description, owner_id, status) VALUES (?, ?, ?, ?, 'queued')"
      ).bind(id, title, description, ownerId).run();
      return json({ task: { id, title, description, owner_id: ownerId, status: "queued" } }, 201);
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === "GET") {
      const id = decodeURIComponent(taskMatch[1]);
      const task = await env.DB.prepare(taskSelectSql() + " WHERE id = ? LIMIT 1").bind(id).first();
      return task ? json({ task }) : json({ error: "Task not found." }, 404);
    }

    const runMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/run$/);
    if (runMatch && request.method === "POST") {
      if (!env.AI) return json({ error: "Workers AI binding is unavailable." }, 503);
      const id = decodeURIComponent(runMatch[1]);
      const task = await env.DB.prepare(taskSelectSql() + " WHERE id = ? LIMIT 1").bind(id).first();
      if (!task) return json({ error: "Task not found." }, 404);
      if (!["queued", "assigned", "blocked"].includes(task.status)) {
        return json({ error: "Task is not eligible to run.", status: task.status }, 409);
      }

      const claimed = await env.DB.prepare(
        "UPDATE tasks SET status = 'in_progress', error = NULL, started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), completed_at = NULL, attempt_count = attempt_count + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status IN ('queued', 'assigned', 'blocked')"
      ).bind(id).run();
      if (!claimed.meta || claimed.meta.changes !== 1) {
        return json({ error: "Task was claimed by another execution or its status changed." }, 409);
      }

      try {
        const agent = getAgentProfile(task.owner_id);
        const messages = [
          {
            role: "system",
            content: "Anda adalah " + agent.name + ", AI Employee berbasis peran di HUMAN CAPITAL WORKSPACE.\n\nMandat: " + agent.mandate + "\n\nKeahlian: " + agent.expertise + "\n\nBuat hasil kerja/draf sesuai mandat peran dan instruksi CEO. Jika tugas berada di luar mandat, jelaskan batasnya dan sarankan fungsi yang relevan. Anda tidak memiliki akses ke sistem perusahaan, file, internet, email, atau alat eksternal. Jangan mengaku telah mengirim pesan, mengubah data, menghubungi orang, atau memverifikasi fakta. Jika data penting tidak tersedia, tandai asumsi dan kebutuhan data secara jelas. Jawab dalam Bahasa Indonesia kecuali instruksi meminta bahasa lain. Berikan output konkret, terstruktur, dan siap ditinjau manusia."
          },
          {
            role: "user",
            content: "PERAN PIC: " + agent.name + "\nMANDAT: " + agent.mandate + "\n\nJUDUL TUGAS:\n" + task.title + "\n\nINSTRUKSI CEO:\n" + task.description + "\n\nPIC ID: " + (task.owner_id ?? "Koordinator lintas fungsi") + "\n\nBuat hasil kerja terbaik yang dapat disusun dari informasi di atas. Pisahkan fakta, asumsi, rekomendasi, dan hal yang perlu dikonfirmasi."
          }
        ];
        const completion = await env.AI.run(AI_MODEL, {
          messages,
          max_completion_tokens: 1200,
          temperature: 0.2,
          stream: false,
          store: false,
          user: "hcw-task-" + id
        });
        const content = completion?.choices?.[0]?.message?.content;
        const result = Array.isArray(content)
          ? content.map(part => typeof part === "string" ? part : (part.text || "")).join("\n")
          : String(content || completion?.response || "").trim();
        if (!result) throw new Error("AI returned an empty result.");

        await env.DB.prepare(
          "UPDATE tasks SET status = 'completed', result = ?, error = NULL, ai_model = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'in_progress'"
        ).bind(result.slice(0, 40000), AI_MODEL, id).run();
        const updated = await env.DB.prepare(taskSelectSql() + " WHERE id = ? LIMIT 1").bind(id).first();
        return json({ task: updated });
      } catch (error) {
        const message = String(error?.message || "AI execution failed.").slice(0, 1000);
        await env.DB.prepare(
          "UPDATE tasks SET status = 'blocked', error = ?, ai_model = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'in_progress'"
        ).bind(message, AI_MODEL, id).run();
        return json({ error: "AI execution failed.", detail: message }, 502);
      }
    }

    return json({ service: "HUMAN CAPITAL WORKSPACE API", error: "Endpoint not found" }, 404);
  }
};
