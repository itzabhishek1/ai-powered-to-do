// Voice command fix
// Example voice input format: "description study algebra title study mathematics"

// Add this manually to your recognitionInstance.onresult function in TodoList.tsx:

const voiceText = event.results[0][0].transcript; // Get the voice text
console.log('Voice text received:', voiceText);

// Check if voice text contains both description and title keywords
if (voiceText.toLowerCase().includes('description') && voiceText.toLowerCase().includes('title')) {
  let title = '';
  let description = '';
  
  // Case 1: "description [text] title [text]"
  if (voiceText.toLowerCase().indexOf('description') < voiceText.toLowerCase().indexOf('title')) {
    const descriptionStart = voiceText.toLowerCase().indexOf('description') + 'description'.length;
    const titleStart = voiceText.toLowerCase().indexOf('title');
    
    description = voiceText.substring(descriptionStart, titleStart).trim();
    title = voiceText.substring(titleStart + 'title'.length).trim();
  } 
  // Case 2: "title [text] description [text]"
  else {
    const titleStart = voiceText.toLowerCase().indexOf('title') + 'title'.length;
    const descriptionStart = voiceText.toLowerCase().indexOf('description');
    
    title = voiceText.substring(titleStart, descriptionStart).trim();
    description = voiceText.substring(descriptionStart + 'description'.length).trim();
  }
  
  console.log('Parsed title:', title);
  console.log('Parsed description:', description);
  
  // Set form data with parsed values
  setFormData({
    title: title,
    description: description,
    deadline: formData.deadline || formatDateForInput(new Date(Date.now() + 86400000)) // Default deadline: tomorrow
  });
  
  setVoiceStatus(`Form filled with title "${title}" and description "${description}"`);
  return; // Exit early after parsing
}

// Original API processing can happen as a fallback
// ...rest of your original code
