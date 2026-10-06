const messages = {
  'Enter a valid email and a password of 12 to 128 characters': 'సరైన ఈమెయిల్ మరియు 12 నుండి 128 అక్షరాల పాస్‌వర్డ్ నమోదు చేయండి',
  'Email or password is incorrect': 'ఈమెయిల్ లేదా పాస్‌వర్డ్ తప్పుగా ఉంది',
  'Please sign in to continue': 'కొనసాగించడానికి లాగిన్ చేయండి',
  'Your account is waiting for administrator approval': 'మీ ఖాతా అడ్మిన్ ఆమోదం కోసం వేచి ఉంది',
  'Your role does not allow this action': 'ఈ చర్యకు మీ పాత్రకు అనుమతి లేదు',
  'Too many attempts. Try again in 15 minutes.': 'చాలా సార్లు ప్రయత్నించారు. 15 నిమిషాల తర్వాత మళ్ళీ ప్రయత్నించండి.',
  'Enter your name (up to 120 characters)': 'మీ పేరు నమోదు చేయండి (గరిష్ఠంగా 120 అక్షరాలు)',
  'Unable to create this account. Try signing in.': 'ఖాతా సృష్టించలేకపోయాము. లాగిన్ చేయడానికి ప్రయత్నించండి.',
  'Enter your current password': 'ప్రస్తుత పాస్‌వర్డ్ నమోదు చేయండి',
  'Current password is incorrect': 'ప్రస్తుత పాస్‌వర్డ్ తప్పుగా ఉంది',
  'Choose a valid role and access status': 'సరైన పాత్ర మరియు అనుమతి స్థితిని ఎంచుకోండి',
  'Account not found': 'ఖాతా కనుగొనబడలేదు',
  'You cannot change the owner or your own access': 'యజమాని లేదా మీ స్వంత అనుమతులను మార్చలేరు',
  'Select a product': 'రకం ఎంచుకోండి',
  'Enter positive lengths and widths': 'పొడవు మరియు వెడల్పు సున్నా కంటే ఎక్కువగా నమోదు చేయండి',
  'Enter a whole quantity from 1 to 100000': '1 నుండి 100000 వరకు పూర్తి సంఖ్యను నమోదు చేయండి',
  'Enter a valid rate': 'సరైన ధరను నమోదు చేయండి',
  'Fill all load details before saving': 'సేవ్ చేయడానికి ముందు అన్ని లోడ్ వివరాలను నమోదు చేయండి',
  'Add at least one measurement row': 'కనీసం ఒక కొలత వరుసను జోడించండి',
  'Enter valid loading/royalty charges': 'సరైన లోడింగ్ / రాయల్టీ ఛార్జీలను నమోదు చేయండి',
  'Add the measurement row you are entering before reviewing': 'తనిఖీ చేయడానికి ముందు నమోదు చేస్తున్న వరుసను జోడించండి',
  'Add the current measurement row before saving': 'సేవ్ చేయడానికి ముందు ప్రస్తుత వరుసను జోడించండి',
  'Add your current row before editing another': 'మరో వరుస మార్చడానికి ముందు ప్రస్తుత వరుసను జోడించండి',
  'Choose a JPEG or PNG logo up to 2 MB': 'గరిష్ఠంగా 2 MB ఉన్న JPEG లేదా PNG లోగో ఎంచుకోండి',
  'Logo must be at most 2 MB': 'లోగో గరిష్ఠంగా 2 MB ఉండాలి',
  'Invalid or oversized JPEG/PNG image': 'JPEG/PNG చిత్రం చెల్లదు లేదా పరిమాణం ఎక్కువగా ఉంది',
  'Invalid business name': 'సరైన వ్యాపార పేరు నమోదు చేయండి',
  'Invalid stone rate entry': 'రకం, ఫినిష్ మరియు సరైన ధర నమోదు చేయండి',
  'Duplicate stone-rate combination': 'ఈ రకం మరియు ఫినిష్ ఇప్పటికే ఉన్నాయి',
  'Failed to fetch': 'సర్వర్‌కు కనెక్ట్ కాలేదు. ఇంటర్నెట్ కనెక్షన్ తనిఖీ చేయండి',
  'This browser cannot keep a recovery copy. Save your draft before leaving.': 'ఈ బ్రౌజర్ రికవరీ కాపీని ఉంచలేదు. బయటకు వెళ్లే ముందు డ్రాఫ్ట్ సేవ్ చేయండి.',
  'Sharing is not supported on this browser. Use the download buttons to share the files manually.': 'ఈ బ్రౌజర్‌లో షేరింగ్ లేదు. ఫైళ్లు డౌన్‌లోడ్ చేసి షేర్ చేయండి.',
  'File sharing is unavailable on this browser/device. Use the download buttons to share the files manually.': 'ఈ పరికరంలో ఫైల్ షేరింగ్ అందుబాటులో లేదు. ఫైళ్లు డౌన్‌లోడ్ చేసి షేర్ చేయండి.'
};
export function translatePilotMessage(message, language) {
  if (language !== 'te') return message;
  const requestFailure = String(message).match(/^Request failed \((\d+)\)$/);
  if (requestFailure) return `అభ్యర్థన విఫలమైంది (${requestFailure[1]}). మళ్ళీ ప్రయత్నించండి.`;
  return messages[message] || message;
}
