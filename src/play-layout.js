// Fit the complete play surface, including all five customers, inside the viewport.
export function playLayout(width, height) {
  const compact = width / height > 1.85;
  const designWidth = compact ? 1100 : 1200;
  const designHeight = compact ? 550 : 780;
  return { compact, width: designWidth, height: designHeight, scale: Math.min((width - 20) / designWidth, (height - 16) / designHeight) };
}
// Use the customer's game clock so pausing also freezes the serving animation.
export function servingOpacity(feedbackMs) {
  return Math.max(0, Math.min(1, (feedbackMs - 2600) / 1200));
}
