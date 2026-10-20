
import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";

import { supabase } from "./lib/supabase";
import Login from "./Pages/Login";
import Signup from "./Pages/Signup";

const BUCKET_NAME = "cloudvault-files";
const MAX_STORAGE = 100 * 1024 * 1024;

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: "▦" },
  { label: "My Files", path: "/files", icon: "▤" },
  { label: "Cloud Storage", path: "/storage", icon: "☁" },
  { label: "Images", path: "/images", icon: "▧" },
  { label: "Documents", path: "/documents", icon: "▣" },
  { label: "Recent Files", path: "/recent", icon: "◷" },
  { label: "Settings", path: "/settings", icon: "⚙" },
];

const pageInfo = {
  dashboard: {
    title: "Dashboard",
    description: "Your personal cloud workspace at a glance.",
  },
  files: {
    title: "My Files",
    description: "Manage, search, download and organize your files.",
  },
  storage: {
    title: "Cloud Storage",
    description: "Review your storage usage and file breakdown.",
  },
  images: {
    title: "Images",
    description: "Access your uploaded images in one place.",
  },
  documents: {
    title: "Documents",
    description: "Find and manage your uploaded documents.",
  },
  recent: {
    title: "Recent Files",
    description: "Your latest files in CloudVault.",
  },
  settings: {
    title: "Settings",
    description: "Manage your account and session.",
  },
};

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileType(name = "") {
  const extension = name.split(".").pop()?.toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) {
    return "Images";
  }

  if (
    ["pdf", "doc", "docx", "txt", "ppt", "pptx", "xls", "xlsx"].includes(
      extension
    )
  ) {
    return "Documents";
  }

  return "Other";
}

function getFileIcon(name = "") {
  const type = getFileType(name);

  if (type === "Images") return "🖼️";
  if (type === "Documents") return "📄";
  return "📁";
}

function StatCard({ title, value, description, icon, color }) {
  const colors = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{value}</h3>
          <p className="mt-2 text-xs text-slate-500">{description}</p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${
            colors[color]
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function FileIcon({ file }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl">
      {getFileIcon(file.name)}
    </div>
  );
}

function UploadButton({ uploading, onUpload }) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 ${
        uploading ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <span className="text-lg">＋</span>
      {uploading ? "Uploading..." : "Upload Files"}

      <input
        type="file"
        multiple
        className="hidden"
        onChange={onUpload}
        disabled={uploading}
      />
    </label>
  );
}

function Dashboard({ page = "dashboard" }) {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentPage = pageInfo[page] || pageInfo.dashboard;

  async function loadCloudFiles(id) {
    const { data, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(id, {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) throw listError;

    const mappedFiles = (data || [])
      .filter((item) => item.name && !item.name.startsWith("."))
      .map((item) => {
        const separatorIndex = item.name.indexOf("__");

        const originalName =
          separatorIndex >= 0
            ? item.name.slice(separatorIndex + 2)
            : item.name;

        return {
          id: item.id || item.name,
          name: originalName,
          path: `${id}/${item.name}`,
          size: Number(item.metadata?.size || 0),
          createdAt: item.created_at || item.updated_at || null,
          type: getFileType(originalName),
        };
      });

    setFiles(mappedFiles);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      const { data, error: authError } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !data?.user) {
        navigate("/", { replace: true });
        return;
      }

      setUserId(data.user.id);
      setEmail(data.user.email || "");

      try {
        // Load files directly; no additional bucket lookup.
        await loadCloudFiles(data.user.id);
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load your cloud files.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleUpload(event) {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";

    if (!selectedFiles.length || !userId) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      for (const file of selectedFiles) {
        const storedName = `${crypto.randomUUID()}__${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(`${userId}/${storedName}`, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) throw uploadError;
      }

      await loadCloudFiles(userId);

      setMessage(
        selectedFiles.length === 1
          ? "File uploaded successfully to cloud storage."
          : `${selectedFiles.length} files uploaded successfully to cloud storage.`
      );
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(file) {
    setError("");
    setMessage("");

    const { data, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(file.path, 60);

    if (downloadError || !data?.signedUrl) {
      setError(downloadError?.message || "Could not create a download link.");
      return;
    }

    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setMessage("Download started.");
  }

  async function handleDelete(file) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${file.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([file.path]);

    if (deleteError) {
      setError(deleteError.message || "Could not delete this file.");
      return;
    }

    setFiles((previous) =>
      previous.filter((item) => item.path !== file.path)
    );

    setMessage("File deleted successfully from cloud storage.");
  }

  async function handleLogout() {
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message || "Could not log out.");
      return;
    }

    navigate("/", { replace: true });
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  const imageCount = files.filter((file) => file.type === "Images").length;
  const documentCount = files.filter(
    (file) => file.type === "Documents"
  ).length;
  const otherCount = files.filter((file) => file.type === "Other").length;

  const storagePercentage = Math.min(
    (totalSize / MAX_STORAGE) * 100,
    100
  );

  const visibleFiles = useMemo(() => {
    let result = [...files];

    if (page === "images") {
      result = result.filter((file) => file.type === "Images");
    }

    if (page === "documents") {
      result = result.filter((file) => file.type === "Documents");
    }

    if (
      filter !== "All" &&
      page !== "images" &&
      page !== "documents"
    ) {
      result = result.filter((file) => file.type === filter);
    }

    if (page === "recent") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
    }

    if (search.trim()) {
      result = result.filter((file) =>
        file.name.toLowerCase().includes(search.trim().toLowerCase())
      );
    }

    return result;
  }, [files, page, filter, search]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
          <p className="mt-4 font-medium text-slate-600">
            Connecting to CloudVault...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 md:flex">
      {/* LEFT SIDEBAR */}
      <aside className="flex w-full shrink-0 flex-col bg-[#111827] text-white md:fixed md:inset-y-0 md:left-0 md:w-64">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-2xl">
            ☁
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-wide">CloudVault</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Cloud File Management
            </p>
          </div>
        </div>

        <div className="px-4 pt-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>

          <nav className="grid grid-cols-2 gap-1 md:grid-cols-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-teal-700 text-white shadow-lg shadow-teal-950/20"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <span className="w-5 text-center text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* ACCOUNT DETAILS ON THE LEFT */}
        <div className="mt-6 px-4 md:mt-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 font-bold text-white">
                {(email[0] || "S").toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  CloudVault account
                </p>
                <p className="mt-1 break-all text-xs leading-5 text-slate-400">
                  {email}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-400" />
                <span className="text-xs font-medium text-slate-300">
                  Cloud storage overview
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                {formatSize(totalSize)} used
              </p>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-teal-400"
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {storagePercentage.toFixed(1)}% of display target
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <span>↪</span>
              Sign out
            </button>
          </div>
        </div>

        <div className="px-6 py-4 text-xs text-slate-500">
          © {new Date().getFullYear()} CloudVault
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 md:ml-64 md:p-8">
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              CLOUD WORKSPACE
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {currentPage.title}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {currentPage.description}
            </p>
          </div>

          {page !== "settings" && (
            <UploadButton uploading={uploading} onUpload={handleUpload} />
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
            <button
              onClick={() => setError("")}
              className="float-right font-bold"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800"
          >
            {message}
            <button
              onClick={() => setMessage("")}
              className="float-right font-bold"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <>
            <section className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-[#111827] via-[#172b3c] to-teal-900 p-6 text-white shadow-lg sm:p-8">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div className="max-w-xl">
                  <p className="text-sm font-medium text-teal-300">
                    YOUR PERSONAL CLOUD
                  </p>

                  <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
                    Welcome to your workspace.
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Upload your files, organize your documents and manage
                    your cloud storage from one workspace.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <UploadButton
                      uploading={uploading}
                      onUpload={handleUpload}
                    />

                    <button
                      onClick={() => navigate("/files")}
                      className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Explore My Files →
                    </button>
                  </div>
                </div>

                <div className="hidden h-32 w-32 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-6xl sm:flex">
                  ☁
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                title="Total Files"
                value={files.length}
                description="Files in your workspace"
                icon="▤"
                color="teal"
              />

              <StatCard
                title="Storage Used"
                value={formatSize(totalSize)}
                description="Combined size of your files"
                icon="☁"
                color="blue"
              />

              <StatCard
                title="Images & Documents"
                value={imageCount + documentCount}
                description={`${imageCount} images · ${documentCount} documents`}
                icon="▣"
                color="purple"
              />
            </section>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Recently uploaded
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Files available in your cloud workspace
                  </p>
                </div>

                <button
                  onClick={() => navigate("/files")}
                  className="shrink-0 text-sm font-semibold text-teal-700 hover:text-teal-900"
                >
                  View all →
                </button>
              </div>

              {files.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-4xl">☁</div>
                  <h4 className="mt-4 font-bold text-slate-900">
                    No files yet
                  </h4>
                  <p className="mt-2 text-sm text-slate-500">
                    Use Upload Files to add your first file.
                  </p>
                </div>
              ) : (
                <div className="mt-5 divide-y divide-slate-100">
                  {files.slice(0, 5).map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between gap-3 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileIcon file={file} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {file.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {file.type} · {formatSize(file.size)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownload(file)}
                        className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* CLOUD STORAGE */}
        {page === "storage" && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-2xl text-teal-700">
                ☁
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                Storage usage
              </h3>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {formatSize(totalSize)}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Combined size of {files.length} files
              </p>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-600"
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {storagePercentage.toFixed(1)}% of the 100 MB display target
              </p>

              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                This is a dashboard estimate, not your actual Supabase storage
                quota.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                File breakdown
              </h3>

              {[
                { label: "Images", count: imageCount, icon: "🖼️" },
                { label: "Documents", count: documentCount, icon: "📄" },
                { label: "Other files", count: otherCount, icon: "📁" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm font-medium text-slate-700">
                      {item.label}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SETTINGS */}
        {page === "settings" && (
          <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-800">
              ⚙
            </div>

            <h3 className="mt-5 text-xl font-bold text-slate-900">
              Account settings
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Account information for your CloudVault workspace.
            </p>

            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email address
              </p>
              <p className="mt-2 break-all text-sm font-medium text-slate-900">
                {email}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cloud storage service
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                Supabase Storage
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Sign out
            </button>
          </section>
        )}

        {/* FILES, IMAGES, DOCUMENTS, RECENT */}
        {["files", "images", "documents", "recent"].includes(page) && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {page === "images"
                    ? "All images"
                    : page === "documents"
                    ? "All documents"
                    : page === "recent"
                    ? "Recent files"
                    : "All your files"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {visibleFiles.length}{" "}
                  {visibleFiles.length === 1 ? "file" : "files"} found
                </p>
              </div>

              <UploadButton
                uploading={uploading}
                onUpload={handleUpload}
              />
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search files by name..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />

              {page !== "images" && page !== "documents" && (
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                >
                  <option value="All">All types</option>
                  <option value="Images">Images</option>
                  <option value="Documents">Documents</option>
                  <option value="Other">Other files</option>
                </select>
              )}
            </div>

            {visibleFiles.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="text-4xl">☁</div>
                <h4 className="mt-4 font-bold text-slate-900">
                  {search ? "No matching files" : "No files found"}
                </h4>
                <p className="mt-2 text-sm text-slate-500">
                  {search
                    ? "Try another search term."
                    : "Use Upload Files to add a file."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-semibold">File name</th>
                        <th className="px-6 py-4 font-semibold">Type</th>
                        <th className="px-6 py-4 font-semibold">Size</th>
                        <th className="px-6 py-4 font-semibold">Uploaded</th>
                        <th className="px-6 py-4 text-right font-semibold">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {visibleFiles.map((file) => (
                        <tr
                          key={file.path}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <FileIcon file={file} />
                              <span
                                className="max-w-56 truncate text-sm font-semibold text-slate-800"
                                title={file.name}
                              >
                                {file.name}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-500">
                            {file.type}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-500">
                            {formatSize(file.size)}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-500">
                            {file.createdAt
                              ? new Date(file.createdAt).toLocaleDateString()
                              : "—"}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleDownload(file)}
                                className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                              >
                                Download
                              </button>

                              <button
                                onClick={() => handleDelete(file)}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile file list */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {visibleFiles.map((file) => (
                    <div key={file.path} className="p-4">
                      <div className="flex items-start gap-3">
                        <FileIcon file={file} />

                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold text-slate-800">
                            {file.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {file.type} · {formatSize(file.size)}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {file.createdAt
                              ? new Date(file.createdAt).toLocaleDateString()
                              : "Date unavailable"}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => handleDownload(file)}
                              className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                            >
                              Download
                            </button>

                            <button
                              onClick={() => handleDelete(file)}
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row">
          <p>CloudVault · Cloud File Management System</p>
          <p>Powered by Supabase</p>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard page="dashboard" />} />
        <Route path="/files" element={<Dashboard page="files" />} />
        <Route path="/storage" element={<Dashboard page="storage" />} />
        <Route path="/images" element={<Dashboard page="images" />} />
        <Route path="/documents" element={<Dashboard page="documents" />} />
        <Route path="/recent" element={<Dashboard page="recent" />} />
        <Route path="/settings" element={<Dashboard page="settings" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
