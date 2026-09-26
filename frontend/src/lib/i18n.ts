// ===========================================================
// NeuroScreen — Lightweight i18n (English + Kannada)
// ===========================================================
// Simple key-value lookup for assessment-flow UI strings.
// Kannada content is transliterated (Roman script) so no
// Kannada keyboard is required.
//
// Usage:
//   import { t } from '@/lib/i18n'
//   const label = t('en', 'assessment.start')
// ===========================================================

import type { LanguageCode } from '@/types/database'

type TranslationKey = string
type Translations = Record<TranslationKey, string>

const translations: Record<LanguageCode, Translations> = {
  en: {
    // --- Language Step ---
    'lang.title': 'Choose Your Language',
    'lang.subtitle': 'Select the language for your assessment prompts and instructions.',
    'lang.english': 'English',
    'lang.kannada': 'Kannada (Transliterated)',
    'lang.continue': 'Continue',

    // --- Module Selection ---
    'modules.title': 'Select Assessment Modules',
    'modules.subtitle': "Choose which modules you'd like to complete. All modules are optional — select at least one.",
    'modules.selectAll': 'Select All',
    'modules.deselectAll': 'Deselect All',
    'modules.requiresMic': 'Requires Microphone',
    'modules.requiresCam': 'Requires Camera',
    'modules.noHardware': 'No special hardware needed',
    'modules.info': 'Modules requiring microphone or camera will ask for permission when that module starts. You can skip any module during the assessment.',
    'modules.error.none': 'Please select at least one assessment module.',
    'modules.back': 'Back',
    'modules.continue': 'Continue',

    // --- Questionnaire ---
    'questionnaire.title': 'Pre-Assessment Context',
    'questionnaire.subtitle': 'These optional questions help contextualize your results. All fields are optional — feel free to skip.',
    'questionnaire.ageRange': 'Age Range',
    'questionnaire.ageRange.placeholder': 'Select your age range',
    'questionnaire.sleepQuality': 'Sleep Quality (Last Night)',
    'questionnaire.sleepQuality.placeholder': 'How well did you sleep?',
    'questionnaire.stressLevel': 'Current Stress Level',
    'questionnaire.stressLevel.placeholder': 'How stressed are you right now?',
    'questionnaire.medication': 'Currently Taking Medication?',
    'questionnaire.medication.placeholder': 'Select an option',
    'questionnaire.back': 'Back',
    'questionnaire.start': 'Start Assessment',
    'questionnaire.starting': 'Starting…',

    // --- Assessment Runner ---
    'runner.module': 'Module',
    'runner.of': 'of',
    'runner.skip': 'Skip Module',
    'runner.skip.title': 'Skip This Module?',
    'runner.skip.description': 'Skipped modules may affect the accuracy of your screening result. Please select a reason for skipping.',
    'runner.skip.reason': 'Reason for skipping',
    'runner.skip.reason.noHardware': 'No required hardware available',
    'runner.skip.reason.preferNot': 'Prefer not to complete this module',
    'runner.skip.reason.technical': 'Technical issue',
    'runner.skip.reason.other': 'Other',
    'runner.skip.confirm': 'Skip Module',
    'runner.skip.cancel': 'Cancel',
    'runner.abandon': 'Abandon Assessment',
    'runner.abandon.title': 'Abandon Assessment?',
    'runner.abandon.description': 'This will end your current assessment session. Any completed module results will still be saved, but the assessment will be marked as abandoned.',
    'runner.abandon.confirm': 'Yes, Abandon',
    'runner.abandon.cancel': 'Continue Assessment',

    // --- Completion ---
    'complete.title': 'Assessment Complete!',
    'complete.subtitle': "Here's a summary of your assessment session.",
    'complete.completed': 'Completed',
    'complete.skipped': 'Skipped',
    'complete.note': 'Assessments with skipped modules may produce less accurate screening results.',
    'complete.viewResults': 'View Results',
    'complete.backToDashboard': 'Return to Dashboard',

    // --- Progress Steps ---
    'progress.language': 'Language',
    'progress.modules': 'Modules',
    'progress.context': 'Context',
    'progress.assessment': 'Assessment',
    'progress.complete': 'Complete',

    // --- Module Names ---
    'module.typing': 'Typing Analysis',
    'module.memory': 'Memory Tests',
    'module.reaction': 'Reaction Time',
    'module.speech': 'Speech Analysis',
    'module.facial': 'Facial Analysis',

    // ============================================================
    // TYPING MODULE
    // ============================================================
    'typing.instructions': 'Type the displayed text as quickly and accurately as you can. We measure your speed, accuracy, and keystroke patterns.',
    'typing.whatWeMessure': 'What we measure',
    'typing.metric.speed': 'Typing speed (WPM and CPM)',
    'typing.metric.accuracy': 'Accuracy percentage',
    'typing.metric.timing': 'Key hold and flight time patterns',
    'typing.metric.corrections': 'Backspace / correction frequency',
    'typing.start': 'Start Typing Test',
    'typing.prompt': 'Type this text:',
    'typing.placeholder': 'Start typing here…',
    'typing.chars': 'characters',
    'typing.finishEarly': 'Finish Early',
    'typing.results.title': 'Typing Analysis Complete',
    'typing.results.subtitle': 'Here are your typing metrics from this session.',
    'typing.results.wpm': 'Words / Min',
    'typing.results.cpm': 'Chars / Min',
    'typing.results.accuracy': 'Accuracy',
    'typing.results.backspaces': 'Backspaces',
    'typing.results.holdTime': 'Avg Hold Time',
    'typing.results.flightTime': 'Avg Flight Time',
    'typing.results.time': 'Total time',
    'typing.results.retry': 'Retry',
    'typing.results.submit': 'Submit & Continue',
    'typing.results.submitting': 'Submitting…',

    // ============================================================
    // MEMORY MODULE
    // ============================================================
    'memory.instructions': 'Complete three memory sub-tests: word recall, number recall, and an image memory matching game. Test your verbal, sequential, and visual working memory.',
    'memory.subTests': 'Three memory tests',
    'memory.test.words': 'Word Recall — memorize and type back words',
    'memory.test.numbers': 'Number Recall — memorize a number sequence',
    'memory.test.images': 'Image Memory — match pairs of illustrated cards',
    'memory.start': 'Start Memory Tests',
    'memory.next': 'Next',

    // Word Recall
    'memory.words.memorize': 'Memorize these words',
    'memory.words.recall': 'Type the words you remember',
    'memory.words.recallHint': 'Type each word separated by spaces or commas. Order does not matter.',
    'memory.words.placeholder': 'apple, river, clock…',

    // Number Recall
    'memory.numbers.memorize': 'Memorize this number sequence',
    'memory.numbers.recall': 'Type the numbers in order',
    'memory.numbers.recallHint': 'Type each number separated by spaces. Order matters.',
    'memory.numbers.placeholder': '3 7 2 9 4',

    // Image Memory Game
    'memory.images.title': 'Memory Game',
    'memory.images.memorize': 'Study the card locations',
    'memory.images.hint': 'Tap cards to flip them and match all 6 pairs in the fewest moves.',
    'memory.images.pairs': 'Pairs Found',
    'memory.images.moves': 'Moves',
    'memory.images.accuracy': 'Accuracy',
    'memory.images.time': 'Time',
    'memory.images.matched': 'All pairs matched!',

    // Memory Results
    'memory.results.title': 'Memory Tests Complete',
    'memory.results.subtitle': 'Here are your accuracy scores across all memory tests.',
    'memory.results.words': 'Word Recall',
    'memory.results.numbers': 'Number Recall',
    'memory.results.images': 'Image Memory Game',
    'memory.results.pattern': 'Image Memory',
    'memory.results.sequence': 'Sequence Memory',
    'memory.results.avgTime': 'Avg completion time',
    'memory.results.retry': 'Retry',
    'memory.results.submit': 'Submit & Continue',
    'memory.results.submitting': 'Submitting…',

    // ============================================================
    // REACTION TIME MODULE
    // ============================================================
    'reaction.instructions': 'Test your reaction time across 10 trials. Wait for the coloured shape to appear, then click/tap as fast as you can. Don\'t click too early!',
    'reaction.howItWorks': 'How it works',
    'reaction.step.wait': 'Wait for the stimulus to appear',
    'reaction.step.react': 'Click or tap as fast as possible',
    'reaction.step.falseStart': 'Clicking too early counts as a false start',
    'reaction.step.trials': '10 trials total',
    'reaction.start': 'Start Reaction Test',
    'reaction.trial': 'Trial',
    'reaction.waitForStimulus': 'Wait for it…',
    'reaction.dontClickYet': 'Don\'t click until you see the shape!',
    'reaction.clickNow': 'CLICK NOW!',
    'reaction.falseStart': 'Too early!',
    'reaction.falseStartHint': 'Wait for the shape to appear before clicking.',
    'reaction.feedback.excellent': 'Excellent!',
    'reaction.feedback.good': 'Good',
    'reaction.feedback.average': 'Average',
    'reaction.feedback.slow': 'Try to be faster',

    // Reaction Results
    'reaction.results.title': 'Reaction Time Complete',
    'reaction.results.subtitle': 'Here are your reaction time metrics from 10 trials.',
    'reaction.results.avgTime': 'Average',
    'reaction.results.fastest': 'Fastest',
    'reaction.results.slowest': 'Slowest',
    'reaction.results.falseStarts': 'False Starts',
    'reaction.results.consistency': 'Consistency',
    'reaction.results.validTrials': 'Valid Trials',
    'reaction.results.timeline': 'Reaction times per trial',
    'reaction.results.retry': 'Retry',
    'reaction.results.submit': 'Submit & Continue',
    'reaction.results.submitting': 'Submitting…',

    // ============================================================
    // SPEECH MODULE
    // ============================================================
    'speech.instructions': 'Read a short passage aloud. We analyse your speech rate, pauses, and overall fluency.',
    'speech.whatWeMeasure': 'What we measure',
    'speech.metric.rate': 'Speech rate (words per minute)',
    'speech.metric.pauses': 'Pause duration and frequency',
    'speech.metric.fluency': 'Overall fluency score',
    'speech.permissionNotice': 'Microphone access required',
    'speech.permissionDetail': 'We need your microphone to record a short audio clip. The recording is processed in memory on our server and immediately discarded — it is never stored.',
    'speech.start': 'Start Recording',
    'speech.recording': 'Recording',
    'speech.remaining': 'remaining',
    'speech.readAloud': 'Read this passage aloud',
    'speech.requestingPermission': 'Requesting Microphone Access',
    'speech.allowMic': 'Please allow microphone access in your browser.',
    'speech.stopRecording': 'Stop Recording',
    'speech.minRecording': 'Record at least 5s',
    'speech.processing': 'Analysing Speech…',
    'speech.processingDetail': 'Extracting speech features from your recording. This may take a few seconds.',
    'speech.error': 'Recording Error',
    'speech.tryAgain': 'Try Again',
    'speech.results.title': 'Speech Analysis Complete',
    'speech.results.subtitle': 'Here are your speech metrics from this session.',
    'speech.results.speechRate': 'Speech Rate',
    'speech.results.avgPause': 'Avg Pause',
    'speech.results.fluency': 'Fluency',
    'speech.results.transcript': 'Transcript',
    'speech.results.noTranscript': 'No transcript available.',
    'speech.results.duration': 'Duration',
    'speech.results.retry': 'Retry',
    'speech.results.submit': 'Submit & Continue',
    'speech.results.submitting': 'Submitting…',

    // ============================================================
    // FACIAL MODULE
    // ============================================================
    'facial.instructions': 'Look at the camera for 15 seconds. We analyse blink rate, head movement, and attention.',
    'facial.whatWeMeasure': 'What we measure',
    'facial.metric.blink': 'Blink rate (per minute)',
    'facial.metric.movement': 'Head movement and stability',
    'facial.metric.attention': 'Attention and face orientation',
    'facial.permissionNotice': 'Camera access required',
    'facial.permissionDetail': 'We need your camera to capture a short video burst. Frames are processed in memory on our server and immediately discarded — they are never stored.',
    'facial.start': 'Start Capture',
    'facial.capturing': 'Capturing',
    'facial.frames': 'frames',
    'facial.lookAtScreen': 'Look at the screen naturally',
    'facial.requestingPermission': 'Requesting Camera Access',
    'facial.allowCamera': 'Please allow camera access in your browser.',
    'facial.processing': 'Analysing Frames…',
    'facial.processingDetail': 'Extracting facial features from captured frames. This may take a few seconds.',
    'facial.error': 'Camera Error',
    'facial.tryAgain': 'Try Again',
    'facial.results.title': 'Facial Analysis Complete',
    'facial.results.subtitle': 'Here are your facial analysis metrics from this session.',
    'facial.results.blinkRate': 'Blink Rate',
    'facial.results.headMovement': 'Head Movement',
    'facial.results.stability': 'Stability',
    'facial.results.attention': 'Attention',
    'facial.results.experimental': 'Experimental / Non-diagnostic',
    'facial.results.smileLikelihood': 'Smile Likelihood',
    'facial.results.retry': 'Retry',
    'facial.results.submit': 'Submit & Continue',
    'facial.results.submitting': 'Submitting…',

    // --- Disclaimer ---
    'disclaimer': 'This application is intended for behavioural screening and educational/research purposes only. It is NOT a medical diagnosis and cannot replace evaluation by a qualified healthcare professional.',
  },

  kn: {
    // --- Language Step ---
    'lang.title': 'Nimma Bhaasheyannnu Aayke Maadi',
    'lang.subtitle': 'Nimmma assessment suchane mattu maargadarshana bhaasheyannuu aayke maadi.',
    'lang.english': 'English',
    'lang.kannada': 'Kannada (Lipyantara)',
    'lang.continue': 'Munduvarisi',

    // --- Module Selection ---
    'modules.title': 'Assessment Module-galannuu Aayke Maadi',
    'modules.subtitle': 'Nivu poorthi maadalu bhaayisuvva module-galannuu aayke maadi. Ella module-galu optional — kammi-paksha ondannuu aayke maadi.',
    'modules.selectAll': 'Ellvannu Aayke Maadi',
    'modules.deselectAll': 'Ellvannu Bittu Bidi',
    'modules.requiresMic': 'Microphone Beku',
    'modules.requiresCam': 'Camera Beku',
    'modules.noHardware': 'Visheshha hardware beda',
    'modules.info': 'Microphone athavaa camera beku-aadha module-galu aa module shuru-aada-gaaga anumathi kealuttave. Nivu yaaavudhe module-annuu assessment-nalli skip maadabahudu.',
    'modules.error.none': 'Dayavittu kammi-paksha ondu assessment module-annuu aayke maadi.',
    'modules.back': 'Hinde',
    'modules.continue': 'Munduvarisi',

    // --- Questionnaire ---
    'questionnaire.title': 'Assessment Poorva Sandarbha',
    'questionnaire.subtitle': 'Ee aykeyaada prashne-galu nimma phalitamsha-galannuu arthaisalu sahaaya maaduttave. Ella kshetra-galu optional.',
    'questionnaire.ageRange': 'Vayas Shrenni',
    'questionnaire.ageRange.placeholder': 'Nimma vayas shrenniyannuu aayke maadi',
    'questionnaire.sleepQuality': 'Nidre Guna Matta (Ninneyya Raatri)',
    'questionnaire.sleepQuality.placeholder': 'Nivu hege nidde maadidiri?',
    'questionnaire.stressLevel': 'Prathyuttha Stress Matta',
    'questionnaire.stressLevel.placeholder': 'Nivu ee kshannadalli eshtu stress-nalli iddira?',
    'questionnaire.medication': 'Prathyuttha Oushadha Sevane?',
    'questionnaire.medication.placeholder': 'Ondu aayke maadi',
    'questionnaire.back': 'Hinde',
    'questionnaire.start': 'Assessment Shuru Maadi',
    'questionnaire.starting': 'Shuru aaguttide…',

    // --- Assessment Runner ---
    'runner.module': 'Module',
    'runner.of': 'ralli',
    'runner.skip': 'Module Skip Maadi',
    'runner.skip.title': 'Ee Module-annuu Skip Maaduvudhe?',
    'runner.skip.description': 'Skip maadidha module-galu nimma screening phalitamsha-dha neravaagisuvi-kke-yannuu prabhaavisi-bahudu. Dayavittu skip maadalu ondu kaarana aayke maadi.',
    'runner.skip.reason': 'Skip kaarana',
    'runner.skip.reason.noHardware': 'Beku-aadha hardware illade',
    'runner.skip.reason.preferNot': 'Ee module poorthi maadalu ishthapaduvudilla',
    'runner.skip.reason.technical': 'Technical samasyey',
    'runner.skip.reason.other': 'Bere',
    'runner.skip.confirm': 'Module Skip Maadi',
    'runner.skip.cancel': 'Raddu Maadi',
    'runner.abandon': 'Assessment Biduvu',
    'runner.abandon.title': 'Assessment Biduvira?',
    'runner.abandon.description': 'Idu nimma prathyuttha assessment anubhavannuu kalleyuttadhe. Yaaavudhe poorthi-aadha module phalitamsha-galu ulidhukolluttave, aadhare assessment abandon endhu guruttu maadalaaguttadhe.',
    'runner.abandon.confirm': 'Haudu, Bidu',
    'runner.abandon.cancel': 'Assessment Munduvarisi',

    // --- Completion ---
    'complete.title': 'Assessment Poorthi Aayithu!',
    'complete.subtitle': 'Nimma assessment anubhavadha saraamshavidhey.',
    'complete.completed': 'Poorthi Aayithu',
    'complete.skipped': 'Skip Maadalaayithu',
    'complete.note': 'Skip-aadha module-galu iruvva assessment-galu kammi neravaada screening phalitamsha-galannuu neeadabahudu.',
    'complete.viewResults': 'Phalitamsha-galannuu Noadi',
    'complete.backToDashboard': 'Dashboard-ge Hogi',

    // --- Progress Steps ---
    'progress.language': 'Bhaashe',
    'progress.modules': 'Module-galu',
    'progress.context': 'Sandarbha',
    'progress.assessment': 'Assessment',
    'progress.complete': 'Poorthi',

    // --- Module Names ---
    'module.typing': 'Typing Vishleyshane',
    'module.memory': 'Smruthi Pariksha',
    'module.reaction': 'Pratikriye Samaya',
    'module.speech': 'Maathu Vishleyshane',
    'module.facial': 'Mukha Vishleyshane',

    // ============================================================
    // TYPING MODULE (Kannada transliterated)
    // ============================================================
    'typing.instructions': 'Thorisidha text-annuu saadhyavaadha vegavaagi mattu neravaaagi type maadi. Naavu nimma vega, neravaagatanavu mattu keystroke maadari-galannuu alathemvu.',
    'typing.whatWeMessure': 'Naavu yeavannuu alatthemvu',
    'typing.metric.speed': 'Typing vega (WPM mattu CPM)',
    'typing.metric.accuracy': 'Neravaagatanavu shatamana',
    'typing.metric.timing': 'Key hididukolli mattu haraha samaya maadari-galu',
    'typing.metric.corrections': 'Backspace / tidhdhupadi aavartane',
    'typing.start': 'Typing Test Shuru Maadi',
    'typing.prompt': 'Ee text-annuu type maadi:',
    'typing.placeholder': 'Illi type maadalu shuru maadi…',
    'typing.chars': 'aksharaa-galu',
    'typing.finishEarly': 'Bega Mugisi',
    'typing.results.title': 'Typing Vishleyshane Poorthi',
    'typing.results.subtitle': 'Ee session-ninda nimma typing alathey-galu ivey.',
    'typing.results.wpm': 'Padha / Ni',
    'typing.results.cpm': 'Akshara / Ni',
    'typing.results.accuracy': 'Neravaagatanavu',
    'typing.results.backspaces': 'Backspace-galu',
    'typing.results.holdTime': 'Sar Hold Samaya',
    'typing.results.flightTime': 'Sar Haraha Samaya',
    'typing.results.time': 'Otta samaya',
    'typing.results.retry': 'Matte Prayatnisi',
    'typing.results.submit': 'Salikodi & Munduvarisi',
    'typing.results.submitting': 'Salikoduttide…',

    // ============================================================
    // MEMORY MODULE (Kannada transliterated)
    // ============================================================
    'memory.instructions': 'Mooru smruthi upa-pariksha-galannuu poorthi maadi: padha nenapu, sankhye nenapu, mattu chitra smruthi jothe aata. Prathi pariksha nimage edhannaadharu jnapisi nanthara punararambisalu heeluttadhe.',
    'memory.subTests': 'Mooru smruthi pariksha-galu',
    'memory.test.words': 'Padha Nenapu — padha-galannuu jnapisi mattu type maadi',
    'memory.test.numbers': 'Sankhye Nenapu — sankhye kramavannuu jnapisi',
    'memory.test.images': 'Chitra Smruthi Aata — jothe-galannuu seri-maadi',
    'memory.start': 'Smruthi Pariksha Shuru Maadi',
    'memory.next': 'Mundina',

    // Word Recall
    'memory.words.memorize': 'Ee padha-galannuu jnapisi',
    'memory.words.recall': 'Nimage nenaphiruvva padha-galannuu type maadi',
    'memory.words.recallHint': 'Prathi padhavannuu spaces athavaa commas-inda berea maadi. Kramavu mukhya alla.',
    'memory.words.placeholder': 'sebu, nadhi, gadiyaara…',

    // Number Recall
    'memory.numbers.memorize': 'Ee sankhye kramavannuu jnapisi',
    'memory.numbers.recall': 'Sankhye-galannuu kramadalli type maadi',
    'memory.numbers.recallHint': 'Prathi sankhyeyannuu spaces-inda berea maadi. Kramavu mukhya.',
    'memory.numbers.placeholder': '3 7 2 9 4',

    // Image Memory Game
    'memory.images.title': 'Smruthi Aata',
    'memory.images.memorize': 'Card sthala-galannuu lakshyadalli ittu-kolli',
    'memory.images.hint': 'Card-galannuu tirugisi 6 jothe-galannuu kammi prayogadalli kanduhidiyiri.',
    'memory.images.pairs': 'Serida Jothegalu',
    'memory.images.moves': 'Prayogagalu',
    'memory.images.accuracy': 'Neravagathana',
    'memory.images.time': 'Samaya',
    'memory.images.matched': 'Ella jothegalu seridave!',

    // Memory Results
    'memory.results.title': 'Smruthi Pariksha Poorthi',
    'memory.results.subtitle': 'Mooru smruthi pariksha-galalli nimma neravaagatanavu amsha-galu ivey.',
    'memory.results.words': 'Padha Nenapu',
    'memory.results.numbers': 'Sankhye Nenapu',
    'memory.results.images': 'Chitra Smruthi Aata',
    'memory.results.pattern': 'Chitra Smruthi',
    'memory.results.sequence': 'Kramavu Smruthi',
    'memory.results.avgTime': 'Sarasari poorthi samaya',
    'memory.results.retry': 'Matte Prayatnisi',
    'memory.results.submit': 'Salikodi & Munduvarisi',
    'memory.results.submitting': 'Salikoduttide…',

    // ============================================================
    // REACTION TIME MODULE (Kannada transliterated)
    // ============================================================
    'reaction.instructions': '10 prayoga-galalli nimma pratikriye samayavannuu parikshi. Bannada aakara kanisuvvare thanikaagi, nanthara saadhyavaadha vegavaagi click/tap maadi. Tumba bega click maadabeadi!',
    'reaction.howItWorks': 'Hege kaary maaduttadhe',
    'reaction.step.wait': 'Pracheadane kanisuvvare kaayiri',
    'reaction.step.react': 'Saadhyavaadha vegavaagi click athavaa tap maadi',
    'reaction.step.falseStart': 'Tumba bega click maadidare false start endu ganise',
    'reaction.step.trials': '10 prayoga-galu otte',
    'reaction.start': 'Pratikriye Pariksha Shuru Maadi',
    'reaction.trial': 'Prayoga',
    'reaction.waitForStimulus': 'Kaayiri…',
    'reaction.dontClickYet': 'Aakara kanisuvavaregu click maadabeadi!',
    'reaction.clickNow': 'EEGA CLICK MAADI!',
    'reaction.falseStart': 'Tumba bega!',
    'reaction.falseStartHint': 'Click maaduvudarollu aakara kanisuvvare kaayiri.',
    'reaction.feedback.excellent': 'Adbutha!',
    'reaction.feedback.good': 'Chennaaagi',
    'reaction.feedback.average': 'Sarasari',
    'reaction.feedback.slow': 'Vegavaagi prayatnisi',

    // Reaction Results
    'reaction.results.title': 'Pratikriye Samaya Poorthi',
    'reaction.results.subtitle': '10 prayoga-galinda nimma pratikriye samaya alathey-galu ivey.',
    'reaction.results.avgTime': 'Sarasari',
    'reaction.results.fastest': 'Athi Vega',
    'reaction.results.slowest': 'Athi Nilladhana',
    'reaction.results.falseStarts': 'False Shuru-galu',
    'reaction.results.consistency': 'Sthiratey',
    'reaction.results.validTrials': 'Saphal Prayoga-galu',
    'reaction.results.timeline': 'Prathi prayogadha pratikriye samaya',
    'reaction.results.retry': 'Matte Prayatnisi',
    'reaction.results.submit': 'Salikodi & Munduvarisi',
    'reaction.results.submitting': 'Salikoduttide…',

    // ============================================================
    // SPEECH MODULE (Kannada transliterated)
    // ============================================================
    'speech.instructions': 'Ondu chikka bhaagavannuu gattiyaagi oadhi. Naavu nimma maathin vega, nilugade, mattu otta dravyateyannuu vishleyshisutteve.',
    'speech.whatWeMeasure': 'Naavu yeavannuu alatthemvu',
    'speech.metric.rate': 'Maathu vega (nimishakke padha-galu)',
    'speech.metric.pauses': 'Nilugade avadhi mattu aavartane',
    'speech.metric.fluency': 'Otta dravyate amsha',
    'speech.permissionNotice': 'Microphone anumathi beku',
    'speech.permissionDetail': 'Chikka audio clip record maadalu nimage microphone beku. Recording server-nalli smruthiyalli process aagi tudane alisi bidalaaguttadhe — adannuu endhigu sangrahi maaduvudilla.',
    'speech.start': 'Recording Shuru Maadi',
    'speech.recording': 'Record Aaguttide',
    'speech.remaining': 'ulidhidhe',
    'speech.readAloud': 'Ee bhaagavannuu gattiyaagi oadhi',
    'speech.requestingPermission': 'Microphone Anumathi Kealuttide',
    'speech.allowMic': 'Dayavittu nimma browser-nalli microphone anumathiyannuu neadi.',
    'speech.stopRecording': 'Recording Nilisi',
    'speech.minRecording': 'Kammi-paksha 5s record maadi',
    'speech.processing': 'Maathu Vishleyshisuttide…',
    'speech.processingDetail': 'Nimma recording-ninda maathu lakshanagalannuu horetorevudu. Idu kelavu secondu-galu thegadukolluttadhe.',
    'speech.error': 'Recording Dhosha',
    'speech.tryAgain': 'Matte Prayatnisi',
    'speech.results.title': 'Maathu Vishleyshane Poorthi',
    'speech.results.subtitle': 'Ee session-ninda nimma maathu alathey-galu ivey.',
    'speech.results.speechRate': 'Maathu Vega',
    'speech.results.avgPause': 'Sar Nilugade',
    'speech.results.fluency': 'Dravyate',
    'speech.results.transcript': 'Lipyantara',
    'speech.results.noTranscript': 'Lipyantara labhyavilla.',
    'speech.results.duration': 'Avadhi',
    'speech.results.retry': 'Matte Prayatnisi',
    'speech.results.submit': 'Salikodi & Munduvarisi',
    'speech.results.submitting': 'Salikoduttide…',

    // ============================================================
    // FACIAL MODULE (Kannada transliterated)
    // ============================================================
    'facial.instructions': '15 secondu camera-ge noadi. Naavu kannu michuve dar, thaleyha chalaney mattu lakshyavannuu vishleyshisutteve.',
    'facial.whatWeMeasure': 'Naavu yeavannuu alatthemvu',
    'facial.metric.blink': 'Kannu michuve dar (nimishakke)',
    'facial.metric.movement': 'Thaleyha chalanhe mattu sthiratey',
    'facial.metric.attention': 'Lakshya mattu mukha disheygathi',
    'facial.permissionNotice': 'Camera anumathi beku',
    'facial.permissionDetail': 'Chikka video burst capture maadalu nimage camera beku. Frame-galu server-nalli smruthiyalli process aagi tudane alisi bidalaaguttadhe — adannnuu endhigu sangrahi maaduvudilla.',
    'facial.start': 'Capture Shuru Maadi',
    'facial.capturing': 'Capture Aaguttide',
    'facial.frames': 'frame-galu',
    'facial.lookAtScreen': 'Screen-annuu sahajavaagi noadi',
    'facial.requestingPermission': 'Camera Anumathi Kealuttide',
    'facial.allowCamera': 'Dayavittu nimma browser-nalli camera anumathiyannuu neadi.',
    'facial.processing': 'Frame-galannuu Vishleyshisuttide…',
    'facial.processingDetail': 'Capture aadha frame-galinda mukha lakshanagalannuu horetorevudu. Idu kelavu secondu-galu thegadukolluttadhe.',
    'facial.error': 'Camera Dhosha',
    'facial.tryAgain': 'Matte Prayatnisi',
    'facial.results.title': 'Mukha Vishleyshane Poorthi',
    'facial.results.subtitle': 'Ee session-ninda nimma mukha vishleyshane alathey-galu ivey.',
    'facial.results.blinkRate': 'Kannu Michuve',
    'facial.results.headMovement': 'Thaleyha Chalanhe',
    'facial.results.stability': 'Sthiratey',
    'facial.results.attention': 'Lakshya',
    'facial.results.experimental': 'Prayogathmaka / Roga-nirdhaarava alla',
    'facial.results.smileLikelihood': 'Nagey Samabhavyathe',
    'facial.results.retry': 'Matte Prayatnisi',
    'facial.results.submit': 'Salikodi & Munduvarisi',
    'facial.results.submitting': 'Salikoduttide…',

    // --- Disclaimer ---
    'disclaimer': 'Ee application nadevalike ayvari mattu shaikshhanika/samshodhane uddeshha-galakke maathravey. Idu vaiidhyakeeya rogaanirdhaarava alla mattu arha aarogya vruththiparaninda maulyaankannavannuu badhalisalu saaddhyavilla.',
  },
}

/**
 * Translate a key to the given language. Falls back to English if key not found in target language.
 */
export function t(lang: LanguageCode, key: string, _vars?: Record<string, unknown>): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key
}

/**
 * Get all translations for a language.
 */
export function getTranslations(lang: LanguageCode): Translations {
  return translations[lang] ?? translations.en
}

