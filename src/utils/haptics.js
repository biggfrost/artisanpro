export function vibrate(pattern = 10) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

export const haptic = {
  light:   () => vibrate(10),
  medium:  () => vibrate(30),
  heavy:   () => vibrate([30, 10, 30]),
  success: () => vibrate([10, 50, 10]),
  error:   () => vibrate([50, 30, 50]),
  warning: () => vibrate(50),
}
