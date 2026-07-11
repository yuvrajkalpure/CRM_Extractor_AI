'use client';

interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: 'Upload CSV' },
  { number: 2, label: 'Preview' },
  { number: 3, label: 'Processing' },
  { number: 4, label: 'Results' },
];

interface StepIndicatorProps {
  currentStep: number; // 1-4
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="steps-container" role="navigation" aria-label="Import progress">
      {STEPS.map((step, i) => {
        const isCompleted = currentStep > step.number;
        const isActive = currentStep === step.number;

        return (
          <div key={step.number} className="step-item" style={{ display: 'flex', alignItems: 'center' }}>
            <div
              className={`step-circle ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2.5 7L5.5 10L11.5 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span className={`step-label ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
              {step.label}
            </span>

            {i < STEPS.length - 1 && (
              <div className={`step-connector ${isCompleted ? 'completed' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
