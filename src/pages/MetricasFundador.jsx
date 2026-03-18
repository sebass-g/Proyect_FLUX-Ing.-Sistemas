import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";
import { obtenerTotalesAdminHome } from "../servicios/grupos.api";

const FECHA_OPTIONS = [
  { value: "all", label: "Sin filtro de fecha" },
  { value: "1w", label: "Ultima semana" },
  { value: "1m", label: "Ultimo mes" },
  { value: "3m", label: "Ultimos 3 meses" },
  { value: "1y", label: "Ultimo ano" }
];

export default function MetricasFundador() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [esFundadorVista, setEsFundadorVista] = useState(false);
  const [userId, setUserId] = useState(null);
  const [totalesAdmin, setTotalesAdmin] = useState({
    totalGrupos: 0,
    totalRepositorios: 0,
    totalUsuarios: 0
  });
  const [filtroFechaMetricas, setFiltroFechaMetricas] = useState("all");
  const [cargandoTotalesAdmin, setCargandoTotalesAdmin] = useState(false);

  const fechaMetricasLabel =
    FECHA_OPTIONS.find(o => o.value === filtroFechaMetricas)?.label || "Sin filtro de fecha";
  const maxTotalAdmin = useMemo(
    () => Math.max(totalesAdmin.totalGrupos, totalesAdmin.totalRepositorios, totalesAdmin.totalUsuarios, 1),
    [totalesAdmin]
  );
  const mitadEscalaAdmin = useMemo(() => Math.round(maxTotalAdmin / 2), [maxTotalAdmin]);
  const altoBarraRepos = Math.max((totalesAdmin.totalRepositorios / maxTotalAdmin) * 100, 10);
  const altoBarraGrupos = Math.max((totalesAdmin.totalGrupos / maxTotalAdmin) * 100, 10);
  const altoBarraUsuarios = Math.max((totalesAdmin.totalUsuarios / maxTotalAdmin) * 100, 10);

  async function cargarPerfilFundador() {
    try {
      setCargandoPerfil(true);
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const user = session?.user;
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }
      setUserId(user.id);

      const { data: perfilData, error: perfilError } = await supabase
        .from("profiles")
        .select("is_fundador")
        .eq("id", user.id)
        .maybeSingle();
      if (perfilError) throw perfilError;

      setEsFundadorVista(Boolean(perfilData?.is_fundador));
    } catch (e) {
      setError(e.message || "No se pudo validar el perfil.");
      setEsFundadorVista(false);
    } finally {
      setCargandoPerfil(false);
    }
  }

  async function cargarTotalesAdminPanel() {
    try {
      setCargandoTotalesAdmin(true);
      const totales = await obtenerTotalesAdminHome({ fechaFiltro: filtroFechaMetricas });
      setTotalesAdmin(totales);
    } catch (e) {
      setError(e.message || "No se pudieron cargar las metricas.");
    } finally {
      setCargandoTotalesAdmin(false);
    }
  }

  useEffect(() => {
    cargarPerfilFundador();
  }, []);

  useEffect(() => {
    if (cargandoPerfil || !esFundadorVista) return;
    cargarTotalesAdminPanel();
  }, [cargandoPerfil, esFundadorVista, filtroFechaMetricas]);

  useEffect(() => {
    if (cargandoPerfil || !esFundadorVista) return;

    const channel = supabase
      .channel(`fundador-metricas-${userId || "anon"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "grupos" }, () => {
        cargarTotalesAdminPanel();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "repositorios_publicos" },
        () => {
          cargarTotalesAdminPanel();
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        cargarTotalesAdminPanel();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargandoPerfil, esFundadorVista, userId]);

  return (
    <div className="container home-container">
      <div className="home-header-strip">
        <button className="btn arrow-back" onClick={() => navigate("/grupos")} aria-label="Atras">
          <svg className="arrow-back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 6L9 12L15 18"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="home-header-title-wrap">
          <div className="home-header-title">Metricas</div>
          <div className="logoDot home-header-dot" />
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      {cargandoPerfil ? (
        <div className="card">
          <div className="label" style={{ marginBottom: 0 }}>Cargando perfil...</div>
        </div>
      ) : !esFundadorVista ? (
        <div className="card">
          <strong>Acceso restringido</strong>
          <div className="label">Solo usuarios fundadores pueden ver metricas.</div>
          <button className="btn" onClick={() => navigate("/grupos")}>Volver</button>
        </div>
      ) : (
        <div className="card admin-stats-card" style={{ marginBottom: 12 }}>
          <div className="admin-stats-head">
            <strong>Panel administrativo</strong>
            <span className="admin-stats-caption">Estado general de la plataforma</span>
          </div>

          <div className="admin-stats-filter-wrap">
            <label className="label admin-stats-filter-label">Rango de fechas</label>
            <select
              className="input admin-stats-filter-select"
              value={filtroFechaMetricas}
              onChange={e => setFiltroFechaMetricas(e.target.value)}
            >
              {FECHA_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {cargandoTotalesAdmin ? (
            <div className="label" style={{ marginBottom: 0 }}>Cargando metricas...</div>
          ) : (
            <>
              <div className="admin-stats-grid">
                <div className="admin-stat-tile">
                  <div className="admin-stat-top">
                    <span className="admin-stat-label">Repositorios</span>
                    <span className="admin-stat-value">{totalesAdmin.totalRepositorios}</span>
                  </div>
                </div>

                <div className="admin-stat-tile">
                  <div className="admin-stat-top">
                    <span className="admin-stat-label">Grupos</span>
                    <span className="admin-stat-value">{totalesAdmin.totalGrupos}</span>
                  </div>
                </div>

                <div className="admin-stat-tile">
                  <div className="admin-stat-top">
                    <span className="admin-stat-label">Usuarios</span>
                    <span className="admin-stat-value">{totalesAdmin.totalUsuarios}</span>
                  </div>
                </div>
              </div>

              <div className="admin-bars-chart" role="img" aria-label={`Grafico de barras (${fechaMetricasLabel})`}>
                <div className="admin-bars-body">
                  <div className="admin-y-axis" aria-hidden="true">
                    <span>{maxTotalAdmin}</span>
                    <span>{mitadEscalaAdmin}</span>
                    <span>0</span>
                  </div>

                  <div className="admin-bars-plot">
                    <div className="admin-bars-col">
                      <div className="admin-bars-bar-wrap">
                        <div
                          className="admin-bars-bar repos"
                          style={{ height: `${altoBarraRepos}%` }}
                        />
                      </div>
                      <div className="admin-bars-label">Repos</div>
                      <div className="admin-bars-value">{totalesAdmin.totalRepositorios}</div>
                    </div>

                    <div className="admin-bars-col">
                      <div className="admin-bars-bar-wrap">
                        <div
                          className="admin-bars-bar grupos"
                          style={{ height: `${altoBarraGrupos}%` }}
                        />
                      </div>
                      <div className="admin-bars-label">Grupos</div>
                      <div className="admin-bars-value">{totalesAdmin.totalGrupos}</div>
                    </div>

                    <div className="admin-bars-col">
                      <div className="admin-bars-bar-wrap">
                        <div
                          className="admin-bars-bar usuarios"
                          style={{ height: `${altoBarraUsuarios}%` }}
                        />
                      </div>
                      <div className="admin-bars-label">Usuarios</div>
                      <div className="admin-bars-value">{totalesAdmin.totalUsuarios}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="label" style={{ marginBottom: 0 }}>
                Mostrando metricas: {fechaMetricasLabel}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
