import type { IconType } from 'react-icons';
import { SiPostgresql } from 'react-icons/si';
import {
  PiArrowUDownLeftDuotone,
  PiBombDuotone,
  PiBracketsCurlyDuotone,
  PiBroadcastDuotone,
  PiBroomDuotone,
  PiCheckCircleDuotone,
  PiClockCounterClockwiseDuotone,
  PiCompassDuotone,
  PiConfettiDuotone,
  PiCrownDuotone,
  PiDatabaseDuotone,
  PiDetectiveDuotone,
  PiDoorDuotone,
  PiEyeDuotone,
  PiFlaskDuotone,
  PiFloppyDiskDuotone,
  PiGearSixDuotone,
  PiIdentificationBadgeDuotone,
  PiInfoDuotone,
  PiKeyDuotone,
  PiLifebuoyDuotone,
  PiLightbulbDuotone,
  PiLightningDuotone,
  PiLockKeyDuotone,
  PiLockKeyOpenDuotone,
  PiMagnifyingGlassDuotone,
  PiMaskHappyDuotone,
  PiMouseDuotone,
  PiPackageDuotone,
  PiPencilSimpleLineDuotone,
  PiProhibitDuotone,
  PiRocketLaunchDuotone,
  PiRulerDuotone,
  PiScrollDuotone,
  PiSealCheckDuotone,
  PiShieldCheckDuotone,
  PiShieldStarDuotone,
  PiSirenDuotone,
  PiSparkleDuotone,
  PiStackDuotone,
  PiSyringeDuotone,
  PiTableDuotone,
  PiTargetDuotone,
  PiTrashDuotone,
  PiTrophyDuotone,
  PiUserCircleDuotone,
  PiUserDuotone,
  PiWarningDuotone,
  PiWrenchDuotone,
  PiXCircleDuotone,
} from 'react-icons/pi';
import { BurstIcon, TenantHopIcon } from './custom';

export { ElephantBouncer } from './custom';

/**
 * Semantic icon names used across the app and in MDX (`<Icon name="rls" />`).
 * Phosphor duotone from react-icons for a friendly, consistent look; custom SVGs fill the gaps.
 */
export const ICONS = {
  // brand
  postgres: SiPostgresql,
  database: PiDatabaseDuotone,
  table: PiTableDuotone,
  // topics
  rls: PiShieldCheckDuotone,
  roles: PiKeyDuotone,
  functions: PiGearSixDuotone,
  triggers: PiMouseDuotone,
  production: PiShieldStarDuotone,
  indexes: PiMagnifyingGlassDuotone,
  mvcc: PiClockCounterClockwiseDuotone,
  jsonb: PiBracketsCurlyDuotone,
  partitioning: PiStackDuotone,
  backups: PiLifebuoyDuotone,
  // personas
  superuser: PiSparkleDuotone,
  owner: PiCrownDuotone,
  astronaut: PiRocketLaunchDuotone,
  member: PiWrenchDuotone,
  scientist: PiFlaskDuotone,
  anon: PiDetectiveDuotone,
  user: PiUserDuotone,
  userCircle: PiUserCircleDuotone,
  // security objects
  lock: PiLockKeyDuotone,
  unlock: PiLockKeyOpenDuotone,
  door: PiDoorDuotone,
  badge: PiIdentificationBadgeDuotone,
  compass: PiCompassDuotone,
  eye: PiEyeDuotone,
  // pipeline
  statement: PiPencilSimpleLineDuotone,
  clean: PiBroomDuotone,
  constraint: PiRulerDuotone,
  write: PiFloppyDiskDuotone,
  audit: PiScrollDuotone,
  commit: PiConfettiDuotone,
  skip: PiProhibitDuotone,
  rollback: PiArrowUDownLeftDuotone,
  trigger: PiLightningDuotone,
  // attacks
  injection: PiSyringeDuotone,
  bomb: PiBombDuotone,
  tenantHop: TenantHopIcon as IconType,
  hijack: PiMaskHappyDuotone,
  sniff: PiBroadcastDuotone,
  burst: BurstIcon as IconType,
  // feedback
  ok: PiCheckCircleDuotone,
  fail: PiXCircleDuotone,
  verified: PiSealCheckDuotone,
  trash: PiTrashDuotone,
  package: PiPackageDuotone,
  target: PiTargetDuotone,
  trophy: PiTrophyDuotone,
  tip: PiLightbulbDuotone,
  note: PiInfoDuotone,
  warn: PiWarningDuotone,
  danger: PiSirenDuotone,
  sparkle: PiSparkleDuotone,
  lab: PiFlaskDuotone,
  version: PiSealCheckDuotone,
} satisfies Record<string, IconType>;

export type IconName = keyof typeof ICONS;

type Props = { name: IconName; size?: number | string; className?: string; title?: string };

export function Icon({ name, size = '1em', className, title }: Props) {
  const Cmp = ICONS[name];
  return <Cmp size={size} className={className} aria-hidden={title ? undefined : true} aria-label={title} role={title ? 'img' : undefined} style={{ display: 'inline-block', verticalAlign: '-0.125em', flexShrink: 0 }} />;
}
