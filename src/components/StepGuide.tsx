interface Step {
  icon: string;
  title: string;
  description: string;
}

interface StepGuideProps {
  steps: Step[];
  currentStep: number;
}

export function StepGuide({ steps, currentStep }: StepGuideProps) {
  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isDone = index < currentStep;

        return (
          <div
            key={index}
            className={`
              flex items-start gap-3 p-3 rounded-lg transition-all
              ${isActive ? 'bg-blue-50 border border-blue-200 shadow-sm' : ''}
              ${isDone ? 'opacity-60' : ''}
            `}
          >
            <div
              className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${isDone ? 'bg-green-500 text-white' : ''}
                ${isActive ? 'bg-blue-500 text-white' : ''}
                ${!isActive && !isDone ? 'bg-slate-200 text-slate-500' : ''}
              `}
            >
              {isDone ? '✓' : step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                {step.title}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {step.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
