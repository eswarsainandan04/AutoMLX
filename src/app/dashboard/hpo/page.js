export default function HpoPage() {
  return (
    <div
      className="space-y-10"
      style={{
        fontFamily: 'var(--font-space-grotesk), var(--font-ibm-plex-sans), "Sora", sans-serif',
        color: "#0f172a",
      }}
    >
      <section
        className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-8"
        style={{
          backgroundImage:
            "radial-gradient(1200px 600px at 10% -10%, rgba(14,165,233,0.18), transparent 60%), radial-gradient(800px 500px at 90% 0%, rgba(34,197,94,0.14), transparent 60%), linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.0))",
        }}
      >
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -left-24 -bottom-20 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">AutoML System</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white">
            Optimized AutoML Pipeline with Integrated HPO
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Coming Soon!!!     </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          {
            title: "System Overview",
            body: [
              "Data and metadata are loaded from storage, including profiling statistics and structural types.",
              "Feature selection produces a stable, task-aware feature set for downstream training.",
              "A fitted ColumnTransformer encodes categorical, numeric, text, and temporal features into a numeric matrix.",
              "Optuna runs HPO per model, ranks tuned scores, and ensembles the top K before final training.",
            ],
          },
          {
            title: "Architecture Layers",
            body: [
              "Data and Metadata Layer: cleaned datasets and profiling context.",
              "Feature Selection Layer: mutual information ranking with thresholds.",
              "Preprocessing Layer: fitted ColumnTransformer with column-wise transforms.",
              "HPO Layer: model-specific search spaces and pruned trials.",
              "Ensembling Layer: voting/averaging across top K tuned models.",
              "Training and Reporting Layer: final pipeline training, metrics, serialization.",
            ],
          },
          {
            title: "Design Guarantees",
            body: [
              "Preprocessing happens once per dataset to avoid leakage and repeated fitting.",
              "HPO consumes only transformed data to ensure trial-to-trial consistency.",
              "Model ranking is based on optimized CV scores, not default hyperparameters.",
              "Top-K ensembling stabilizes performance across data splits.",
              "Final training uses the same fitted preprocessor to avoid feature mismatch.",
            ],
          },
        ].map((card, idx) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm animate-fade-up"
            style={{ animationDelay: `${idx * 90}ms` }}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{card.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {card.body.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Pipeline Flow</h2>
            <div className="mt-4 space-y-6 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Before HPO</h3>
                <ul className="mt-2 space-y-2">
                  <li>Cleaned dataset is loaded from storage.</li>
                  <li>Selected features are applied.</li>
                  <li>Data types are enforced from profiling metadata.</li>
                  <li>Dataset is split into train and validation sets.</li>
                  <li>ColumnTransformer is built and fitted.</li>
                  <li>Training data is transformed.</li>
                </ul>
                <pre className="mt-3 rounded-xl bg-slate-900 text-slate-100 text-xs p-4 overflow-x-auto">
                  <code>X_train_transformed = preprocessor.transform(X_train)</code>
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">HPO Stage</h3>
                <ul className="mt-2 space-y-2">
                  <li>Optuna runs cross-validated trials per model.</li>
                  <li>Search space is defined dynamically by model type.</li>
                  <li>Only transformed data is used; no preprocessing inside HPO.</li>
                  <li>Classification uses accuracy, regression uses R2.</li>
                  <li>Median pruner stops unpromising trials early.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">After HPO</h3>
                <ul className="mt-2 space-y-2">
                  <li>Tuned models are ranked using optimized CV scores.</li>
                  <li>Top K models are selected and ensembled (voting/averaging).</li>
                  <li>Best hyperparameters are applied to each top model.</li>
                  <li>Final pipeline is built, trained, and validated once.</li>
                </ul>
                <pre className="mt-3 rounded-xl bg-slate-900 text-slate-100 text-xs p-4 overflow-x-auto">
                  <code>{"Pipeline([\n  (\"preprocessor\", preprocessor),\n  (\"ensemble\", voting_model)\n])"}</code>
                </pre>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-96">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-6">
              <h3 className="text-sm uppercase tracking-[0.28em] text-slate-300">Scoring Policy</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Classification</span>
                  <span className="font-semibold text-emerald-300">accuracy</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Regression</span>
                  <span className="font-semibold text-sky-300">r2</span>
                </div>
                <div className="border-t border-white/10 pt-3 text-xs text-slate-300">
                  HPO replaces default CV scoring to keep comparisons consistent across models.
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Key Design Decisions</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>Separation of feature engineering, HPO, and training modules.</li>
                <li>Preprocessing outside HPO to prevent repeated fitting.</li>
                <li>Dynamic trial allocation based on dataset size.</li>
                <li>Candidate models filtered by dataset size and feature types.</li>
                <li>Ensemble strategy uses top K tuned models.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Advantages</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Fully automated pipeline with reproducible runs.</li>
            <li>Efficient model selection through optimized HPO scores.</li>
            <li>Reduced compute by eliminating redundant preprocessing.</li>
            <li>Top-K ensemble improves stability and generalization.</li>
            <li>Scales across datasets with heterogeneous feature types.</li>
            <li>Consistent preprocessing alignment between HPO and training.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Limitations</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Ensembling uses voting/averaging only (no stacking or blending).</li>
            <li>No meta-learning across historical runs.</li>
            <li>Time series tasks require specialized split strategies.</li>
            <li>Search spaces are bounded and may miss niche parameter regimes.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
