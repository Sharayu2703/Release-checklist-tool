import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  gql,
  useMutation,
  useQuery,
} from "@apollo/client";
import {
  Plus,
  Search,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Rocket,
  X,
  Info,
  LoaderCircle,
  RefreshCw,
  Pencil,
} from "lucide-react";
import "./styles.css";

const API_URL =
  import.meta.env.VITE_GRAPHQL_URL || "http://localhost:4000/graphql";

const client = new ApolloClient({
  uri: API_URL,
  cache: new InMemoryCache(),
});

const RELEASE_FIELDS = gql`
  fragment ReleaseFields on Release {
    id
    name
    date
    status
    additionalInfo
    completedSteps
    steps {
      index
      label
      completed
    }
    createdAt
    updatedAt
  }
`;

const GET_RELEASES = gql`
  query Releases {
    releases {
      ...ReleaseFields
    }
  }
  ${RELEASE_FIELDS}
`;

const CREATE_RELEASE = gql`
  mutation CreateRelease($input: CreateReleaseInput!) {
    createRelease(input: $input) {
      ...ReleaseFields
    }
  }
  ${RELEASE_FIELDS}
`;

const UPDATE_RELEASE = gql`
  mutation UpdateRelease($id: ID!, $input: UpdateReleaseInput!) {
    updateRelease(id: $id, input: $input) {
      ...ReleaseFields
    }
  }
  ${RELEASE_FIELDS}
`;

const SET_STEP = gql`
  mutation SetStep($id: ID!, $stepIndex: Int!, $completed: Boolean!) {
    setStepCompleted(id: $id, stepIndex: $stepIndex, completed: $completed) {
      ...ReleaseFields
    }
  }
  ${RELEASE_FIELDS}
`;

const DELETE_RELEASE = gql`
  mutation DeleteRelease($id: ID!) {
    deleteRelease(id: $id)
  }
`;

const dateLabel = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const dateInput = (value) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const statusMeta = {
  planned: { label: "Planned", icon: Circle },
  ongoing: { label: "In progress", icon: Clock3 },
  done: { label: "Completed", icon: CheckCircle2 },
};

function App() {
  const { data, loading, error, refetch } = useQuery(GET_RELEASES, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const [createRelease, createState] = useMutation(CREATE_RELEASE, {
    onCompleted: () => {
      setShowCreate(false);
      setForm({
        name: "",
        date: dateInput(new Date(Date.now() + 86400000).toISOString()),
        additionalInfo: "",
      });
    },
  });

  const [updateRelease] = useMutation(UPDATE_RELEASE);
  const [setStep] = useMutation(SET_STEP);

  const [deleteRelease] = useMutation(DELETE_RELEASE, {
    update(cache, { data: result }, { variables }) {
      if (result?.deleteRelease) {
        cache.updateQuery({ query: GET_RELEASES }, (old) =>
          old
            ? {
                releases: old.releases.filter((r) => r.id !== variables.id),
              }
            : old,
        );
      }
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: dateInput(new Date(Date.now() + 86400000).toISOString()),
    additionalInfo: "",
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [editingInfo, setEditingInfo] = useState({});
  const [draftInfo, setDraftInfo] = useState({});
  const [editingRelease, setEditingRelease] = useState({});
  const [draftRelease, setDraftRelease] = useState({});
  const [notice, setNotice] = useState("");

  const releases = data?.releases || [];

  const filtered = useMemo(
    () =>
      releases.filter(
        (r) =>
          (filter === "all" || r.status === filter) &&
          r.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [releases, filter, search],
  );

  const stats = useMemo(
    () => ({
      total: releases.length,
      planned: releases.filter((r) => r.status === "planned").length,
      ongoing: releases.filter((r) => r.status === "ongoing").length,
      done: releases.filter((r) => r.status === "done").length,
    }),
    [releases],
  );

  const run = async (fn) => {
    try {
      await fn();
      setNotice("");
    } catch (e) {
      setNotice(e.message.replace(/^.*?: /, ""));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.date) {
      setNotice("Release name and date are required.");
      return;
    }

    await run(() =>
      createRelease({
        variables: {
          input: {
            name: form.name.trim(),
            date: new Date(form.date).toISOString(),
            additionalInfo: form.additionalInfo,
          },
        },
        refetchQueries: [{ query: GET_RELEASES }],
      }),
    );
  };

  const toggleStep = (release, step) =>
    run(() =>
      setStep({
        variables: {
          id: release.id,
          stepIndex: step.index,
          completed: !step.completed,
        },
        optimisticResponse: {
          setStepCompleted: {
            ...release,
            completedSteps: step.completed
              ? release.completedSteps.filter((i) => i !== step.index)
              : [...release.completedSteps, step.index],
            status: step.completed
              ? release.completedSteps.length === 1
                ? "planned"
                : "ongoing"
              : release.completedSteps.length + 1 === release.steps.length
                ? "done"
                : "ongoing",
            steps: release.steps.map((s) =>
              s.index === step.index ? { ...s, completed: !s.completed } : s,
            ),
            updatedAt: new Date().toISOString(),
            __typename: "Release",
          },
        },
      }),
    );

  const saveInfo = (release) =>
    run(async () => {
      await updateRelease({
        variables: {
          id: release.id,
          input: {
            additionalInfo: draftInfo[release.id] ?? release.additionalInfo,
          },
        },
      });

      setEditingInfo((p) => ({ ...p, [release.id]: false }));
      await refetch();
    });

  const startEditingRelease = (release) => {
    setDraftRelease((p) => ({
      ...p,
      [release.id]: {
        name: release.name,
        date: dateInput(release.date),
      },
    }));

    setEditingRelease((p) => ({ ...p, [release.id]: true }));
  };

  const saveReleaseDetails = (release) =>
    run(async () => {
      const draft = draftRelease[release.id];

      if (!draft?.name?.trim() || !draft?.date) {
        setNotice("Release name and date are required.");
        return;
      }

      const parsedDate = new Date(draft.date);

      if (Number.isNaN(parsedDate.getTime())) {
        setNotice("Please enter a valid release date.");
        return;
      }

      await updateRelease({
        variables: {
          id: release.id,
          input: {
            name: draft.name.trim(),
            date: parsedDate.toISOString(),
          },
        },
      });

      setEditingRelease((p) => ({ ...p, [release.id]: false }));
      await refetch();
    });

  const removeRelease = (release) => {
    if (window.confirm(`Delete "${release.name}"? This cannot be undone.`)) {
      run(() => deleteRelease({ variables: { id: release.id } }));
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Rocket size={19} />
          </div>
          <span>
            shipshape<span className="brand-period">.</span>
          </span>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <div className="side-link active">
          <CalendarDays size={17} /> Release checklist
          <span className="side-count">{stats.total}</span>
        </div>

        <div className="sidebar-bottom">
          <div className="avatar">S</div>
          <div>
            <strong>Solo workspace</strong>
            <small>Personal project</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Releases</strong>
          </div>

          <div className="topbar-right">
            <span className="api-status">
              <i /> API connected
            </span>
            <button
              className="icon-button"
              title="Refresh releases"
              onClick={() => refetch()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow">SHIP WITH CONFIDENCE</div>
            <h1>Release checklist</h1>
            <p className="subtitle">
              Everything in place before your next release.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={17} /> New release
          </button>
        </section>

        <section className="stats-grid">
          <Stat
            icon={<CalendarDays />}
            label="Total releases"
            value={stats.total}
            tone="blue"
          />
          <Stat
            icon={<Circle />}
            label="Planned"
            value={stats.planned}
            tone="slate"
          />
          <Stat
            icon={<Clock3 />}
            label="In progress"
            value={stats.ongoing}
            tone="amber"
          />
          <Stat
            icon={<CheckCircle2 />}
            label="Completed"
            value={stats.done}
            tone="green"
          />
        </section>

        <section className="release-section">
          <div className="section-title">
            <div>
              <h2>Your releases</h2>
              <span>
                {filtered.length}{" "}
                {filtered.length === 1 ? "release" : "releases"}
              </span>
            </div>

            <div className="filters">
              <label className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search releases..."
                  aria-label="Search releases"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="planned">Planned</option>
                <option value="ongoing">In progress</option>
                <option value="done">Completed</option>
              </select>
            </div>
          </div>

          {notice && (
            <div className="notice" role="alert">
              <Info size={16} />
              {notice}
              <button type="button" onClick={() => setNotice("")}>
                <X size={14} />
              </button>
            </div>
          )}

          {loading && !data ? (
            <div className="loading">
              <LoaderCircle className="spin" size={24} />
              Loading releases...
            </div>
          ) : error && !data ? (
            <div className="empty-state">
              <Info size={28} />
              <h3>Couldn't load releases</h3>
              <p>
                Check that the API and database are running, then try again.
              </p>
              <button className="secondary-button" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <CalendarDays size={25} />
              </div>
              <h3>
                {search || filter !== "all"
                  ? "No matching releases"
                  : "Your next release starts here"}
              </h3>
              <p>
                {search || filter !== "all"
                  ? "Try changing your search or status filter."
                  : "Create a release and keep every shipping task on track."}
              </p>

              {!search && filter === "all" && (
                <button
                  className="primary-button"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus size={16} /> Create your first release
                </button>
              )}
            </div>
          ) : (
            <div className="release-list">
              {filtered.map((release) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  expanded={!!expanded[release.id]}
                  onExpand={() =>
                    setExpanded((p) => ({
                      ...p,
                      [release.id]: !p[release.id],
                    }))
                  }
                  onToggle={(step) => toggleStep(release, step)}
                  onDelete={() => removeRelease(release)}
                  editingRelease={!!editingRelease[release.id]}
                  releaseDraft={
                    draftRelease[release.id] || {
                      name: release.name,
                      date: dateInput(release.date),
                    }
                  }
                  onEditRelease={() => startEditingRelease(release)}
                  onReleaseDraft={(value) =>
                    setDraftRelease((p) => ({
                      ...p,
                      [release.id]: {
                        ...(p[release.id] || {
                          name: release.name,
                          date: dateInput(release.date),
                        }),
                        ...value,
                      },
                    }))
                  }
                  onSaveRelease={() => saveReleaseDetails(release)}
                  onCancelRelease={() =>
                    setEditingRelease((p) => ({
                      ...p,
                      [release.id]: false,
                    }))
                  }
                  editing={!!editingInfo[release.id]}
                  draft={draftInfo[release.id] ?? release.additionalInfo}
                  onEdit={() => {
                    setDraftInfo((p) => ({
                      ...p,
                      [release.id]: release.additionalInfo,
                    }));
                    setEditingInfo((p) => ({
                      ...p,
                      [release.id]: true,
                    }));
                  }}
                  onDraft={(value) =>
                    setDraftInfo((p) => ({
                      ...p,
                      [release.id]: value,
                    }))
                  }
                  onSave={() => saveInfo(release)}
                  onCancel={() =>
                    setEditingInfo((p) => ({
                      ...p,
                      [release.id]: false,
                    }))
                  }
                />
              ))}
            </div>
          )}
        </section>

        <footer className="footer">
          <span>
            Shipshape <span className="footer-dot">●</span> Built for smoother
            releases
          </span>
          <span>Release data is saved to your database</span>
        </footer>
      </main>

      {showCreate && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">NEW WORKFLOW</div>
                <h2 id="modal-title">Create a release</h2>
                <p>Give your next release a name and a target date.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowCreate(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="create-form">
              <label>
                Release name <span>*</span>
                <input
                  autoFocus
                  maxLength={160}
                  required
                  placeholder="e.g. v2.4.0 — Spring release"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </label>

              <label>
                Target date and time <span>*</span>
                <input
                  type="datetime-local"
                  required
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                />
              </label>

              <label>
                Additional information <small>OPTIONAL</small>
                <textarea
                  rows={3}
                  placeholder="Release notes, links, reminders..."
                  value={form.additionalInfo}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      additionalInfo: e.target.value,
                    }))
                  }
                />
              </label>

              <div className="form-hint">
                <Info size={15} />
                Every release starts with the same 10-step checklist.
              </div>

              {createState.error && (
                <p className="form-error">{createState.error.message}</p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={createState.loading}
                >
                  {createState.loading ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Create release
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        {React.cloneElement(icon, { size: 18 })}
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ReleaseCard({
  release,
  expanded,
  onExpand,
  onToggle,
  onDelete,
  editingRelease,
  releaseDraft,
  onEditRelease,
  onReleaseDraft,
  onSaveRelease,
  onCancelRelease,
  editing,
  draft,
  onEdit,
  onDraft,
  onSave,
  onCancel,
}) {
  const meta = statusMeta[release.status] || statusMeta.planned;
  const StatusIcon = meta.icon;

  const progress = Math.round(
    (release.completedSteps.length / release.steps.length) * 100,
  );

  return (
    <article className={`release-card ${expanded ? "is-expanded" : ""}`}>
      <div className="release-card-main">
        <button
          type="button"
          className="expand-button"
          onClick={onExpand}
          aria-label={expanded ? "Collapse checklist" : "Expand checklist"}
        >
          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>

        <div className="release-info">
          {editingRelease ? (
            <div className="release-edit-fields">
              <label>
                Release name
                <input
                  maxLength={160}
                  required
                  value={releaseDraft.name}
                  onChange={(e) => onReleaseDraft({ name: e.target.value })}
                  aria-label="Edit release name"
                />
              </label>

              <label>
                Target date and time
                <input
                  type="datetime-local"
                  required
                  value={releaseDraft.date}
                  onChange={(e) => onReleaseDraft({ date: e.target.value })}
                  aria-label="Edit release date and time"
                />
              </label>

              <div className="inline-actions">
                <button
                  type="button"
                  className="secondary-button small"
                  onClick={onCancelRelease}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button small"
                  onClick={onSaveRelease}
                >
                  <Check size={14} /> Save changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="release-name-row">
                <h3>{release.name}</h3>
                <span className={`status-pill ${release.status}`}>
                  <StatusIcon size={13} />
                  {meta.label}
                </span>
              </div>

              <div className="release-meta">
                <span>
                  <CalendarDays size={14} />
                  {dateLabel(release.date)}
                </span>
                <span className="meta-separator">·</span>
                <span>
                  {release.completedSteps.length} of {release.steps.length}{" "}
                  tasks
                </span>
              </div>
            </>
          )}

          <div className="progress-track">
            <div
              className={`progress-fill ${release.status}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="progress-percent">{progress}%</div>

        <div className="release-actions">
          {!editingRelease && (
            <button
              type="button"
              className="icon-button"
              title="Edit release name and date"
              aria-label="Edit release name and date"
              onClick={onEditRelease}
            >
              <Pencil size={16} />
            </button>
          )}

          <button
            type="button"
            className="icon-button delete-button"
            title="Delete release"
            aria-label="Delete release"
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="release-details">
          <div className="checklist-heading">
            <div>
              <h4>Release checklist</h4>
              <p>Tick off each task as you complete it.</p>
            </div>
            <span className="step-count">
              {release.completedSteps.length}/{release.steps.length} done
            </span>
          </div>

          <div className="steps-grid">
            {release.steps.map((step) => (
              <label
                key={step.index}
                className={`step-item ${step.completed ? "checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={step.completed}
                  onChange={() => onToggle(step)}
                />
                <span className="custom-check">
                  {step.completed && <Check size={12} />}
                </span>
                <span>{step.label}</span>
              </label>
            ))}
          </div>

          <div className="additional-info">
            <div className="info-heading">
              <div>
                <h4>Additional information</h4>
                <p>Notes, links, and release-specific context.</p>
              </div>

              {!editing && (
                <button type="button" className="text-button" onClick={onEdit}>
                  {release.additionalInfo ? "Edit notes" : "Add notes"}
                </button>
              )}
            </div>

            {editing ? (
              <>
                <textarea
                  className="info-textarea"
                  rows={3}
                  value={draft}
                  onChange={(e) => onDraft(e.target.value)}
                  placeholder="Add release notes or useful links..."
                />

                <div className="inline-actions">
                  <button
                    type="button"
                    className="secondary-button small"
                    onClick={onCancel}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button small"
                    onClick={onSave}
                  >
                    <Check size={14} /> Save notes
                  </button>
                </div>
              </>
            ) : (
              <p
                className={`saved-info ${release.additionalInfo ? "" : "muted"}`}
              >
                {release.additionalInfo || "No additional information yet."}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);
