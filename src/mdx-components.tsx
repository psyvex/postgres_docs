import type { MDXComponents } from 'mdx/types';
import { Callout } from '@/components/docs/Callout';
import { SqlBlock } from '@/components/sql/SqlBlock';
import { RlsBouncer } from '@/components/animations/RlsBouncer';
import { PrivilegeGrid } from '@/components/animations/PrivilegeGrid';
import { FunctionMachine } from '@/components/animations/FunctionMachine';
import { TriggerPipeline } from '@/components/animations/TriggerPipeline';
import { SecurityHeist } from '@/components/animations/SecurityHeist';
import { InjectionDemo } from '@/components/animations/InjectionDemo';
import { ScanRace } from '@/components/animations/ScanRace';
import { MvccExplainer } from '@/components/animations/MvccExplainer';
import { PartitionPruner } from '@/components/animations/PartitionPruner';
import { PitrTimeline } from '@/components/animations/PitrTimeline';
import { JsonTree } from '@/components/animations/JsonTree';
import { ProjectFiles } from '@/components/animations/ProjectFiles';
import { StackTabs } from '@/components/animations/StackTabs';
import { ResetDemo } from '@/components/docs/ResetDemo';
import { No, Yes } from '@/components/docs/Mark';
import { Icon } from '@/components/icons';

const components: MDXComponents = {
  a: ({ href, children }) => (
    <a href={href} {...(href?.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {children}
    </a>
  ),
  // GFM task lists render disabled, controlled checkboxes; make them tickable during a session.
  input: ({ type, checked, disabled: _disabled, ...rest }) =>
    type === 'checkbox' ? <input type="checkbox" defaultChecked={checked} className="task-check" {...rest} /> : <input type={type} {...rest} />,
  Callout,
  SqlBlock,
  RlsBouncer,
  PrivilegeGrid,
  FunctionMachine,
  TriggerPipeline,
  SecurityHeist,
  InjectionDemo,
  ScanRace,
  MvccExplainer,
  PartitionPruner,
  PitrTimeline,
  JsonTree,
  ProjectFiles,
  StackTabs,
  ResetDemo,
  Icon,
  Yes,
  No,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
