const LIMA_TZ = 'America/Lima'

const clockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LIMA_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LIMA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LIMA_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})

function limaDateParts() {
  const parts = clockFormatter.formatToParts(new Date())

  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')

  return {
    time: `${hour}:${get('minute')}`,
    seconds: get('second'),
    meridiem: Number(hour) >= 12 ? 'pm' : 'am'
  }
}

function limaNow() {
  const dateParts = dateFormatter.formatToParts(new Date())
  const timeParts = timeFormatter.formatToParts(new Date())

  const get = (parts, type) => parts.find((part) => part.type === type)?.value ?? '00'
  let hour = get(timeParts, 'hour')
  if (hour === '24') hour = '00'

  return {
    date: `${get(dateParts, 'year')}-${get(dateParts, 'month')}-${get(dateParts, 'day')}`,
    time: `${hour}:${get(timeParts, 'minute')}:${get(timeParts, 'second')}`
  }
}

export { LIMA_TZ, limaDateParts, limaNow }
