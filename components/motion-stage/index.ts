/**
 * Motion stage — step-driven, animated knowledge demos.
 *
 *   MotionStage           the shell: timeline, playback, narration, code / watch panels
 *   useStage, useStepMatch  read the current step from any custom scene
 *   primitives            StageReveal, StageSwitch/StageCase, StageText, StageNode, StageBadge
 *   scenes                SequenceDiagram, ArrayTrack, BlockGrid, AddressBits, FlowGraph
 *
 * Authoring guide: docs/motion-stage.md.
 */
export { MotionStage, type MotionStageProps } from './motion-stage';
export { useStage, useStepMatch, type StageState } from './stage-context';
export { matchesStep, frameAt } from './step-match';
export * from './motion-presets';
export * from './types';
export {
  StageBadge,
  StageCase,
  StageNode,
  StageReveal,
  StageSwitch,
  StageText,
  useNodeState,
  type StageNodeProps,
  type StageNodeState,
  type StageRevealProps,
} from './primitives';
export { SequenceDiagram, type SequenceActor, type SequenceMessage, type SequenceState, type SequenceDiagramProps } from './scenes/sequence-diagram';
export { ArrayTrack, type ArrayFrame, type ArrayTrackProps } from './scenes/array-track';
export { BlockGrid, type BlockFrame, type BlockGridProps, type GridBlock, type GridMark } from './scenes/block-grid';
export { AddressBits, type AddressField, type AddressBitsProps } from './scenes/address-bits';
export { FlowGraph, type FlowEdge, type FlowFrame, type FlowNode, type FlowGraphProps } from './scenes/flow-graph';
