import { persistDashboardQueuePreferenceAction } from "@/app/dashboard/actions";
import type { DashboardQueueModule } from "@/lib/dashboard-queue-preferences";

type ModuleQueueFilterOption = {
  value: string;
  label: string;
  count: number;
};

type ModuleQueueFiltersProps = {
  module: DashboardQueueModule;
  path: string;
  currentView: string;
  title: string;
  helper: string;
  options: ModuleQueueFilterOption[];
};

export function ModuleQueueFilters({
  module,
  path,
  currentView,
  title,
  helper,
  options,
}: ModuleQueueFiltersProps) {
  const activeOption = options.find((option) => option.value === currentView) || options[0];

  return (
    <section className="data-panel queue-filter-panel">
      <div className="card-header queue-filter-header">
        <div>
          <span className="section-label">Visão da fila</span>
          <h2>{title}</h2>
        </div>
        <div className="queue-filter-summary">
          <strong>{activeOption?.label || "Todos"}</strong>
          <span>Mostrando agora</span>
          <small>{helper}</small>
        </div>
      </div>

      <div className="queue-filter-grid">
        {options.map((option) => (
          <form key={option.value} action={persistDashboardQueuePreferenceAction} className="queue-filter-form">
            <input type="hidden" name="module" value={module} />
            <input type="hidden" name="path" value={path} />
            <input type="hidden" name="view" value={option.value} />
            <input type="hidden" name="focus" value="" />
            <button
              type="submit"
              className={option.value === currentView ? "queue-filter-chip queue-filter-chip-active" : "queue-filter-chip"}
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
