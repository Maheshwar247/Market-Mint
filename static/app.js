/**
 * MarketMint — Local AI Marketing Assistant
 * Frontend Controller & Safe DOM Renderer
 *
 * Security: Untrusted AI model output is rendered strictly using safe DOM nodes
 * and textContent. innerHTML is NEVER used for model responses.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Element References ---
  const modelSelect = document.getElementById("modelSelect");
  const connectionStatus = document.getElementById("connectionStatus");
  const statusText = document.getElementById("statusText");
  const refreshStatusBtn = document.getElementById("refreshStatusBtn");
  const ollamaAlert = document.getElementById("ollamaAlert");
  const alertTitle = document.getElementById("alertTitle");
  const alertMessage = document.getElementById("alertMessage");
  const alertDismissBtn = document.getElementById("alertDismissBtn");

  // Tabs & Forms
  const tabs = document.querySelectorAll(".feature-tab");
  const forms = {
    product: document.getElementById("productForm"),
    whatsapp: document.getElementById("whatsappForm"),
    social: document.getElementById("socialForm")
  };

  // Sample Buttons
  const sampleProductBtn = document.getElementById("sampleProductBtn");
  const sampleWhatsappBtn = document.getElementById("sampleWhatsappBtn");
  const sampleSocialBtn = document.getElementById("sampleSocialBtn");

  // Results State Containers
  const resultsEmpty = document.getElementById("resultsEmpty");
  const resultsLoading = document.getElementById("resultsLoading");
  const resultsSuccess = document.getElementById("resultsSuccess");
  const resultsError = document.getElementById("resultsError");
  const formattedOutput = document.getElementById("formattedOutput");
  const rawOutput = document.getElementById("rawOutput");
  const resultsModelBadge = document.getElementById("resultsModelBadge");
  const charCount = document.getElementById("charCount");
  const languageNotice = document.getElementById("languageNotice");

  // Control Buttons
  const copyBtn = document.getElementById("copyBtn");
  const copyBtnText = document.getElementById("copyBtnText");
  const toggleEditBtn = document.getElementById("toggleEditBtn");
  const toggleEditText = document.getElementById("toggleEditText");
  const retryBtn = document.getElementById("retryBtn");

  // Error Details
  const errorTitle = document.getElementById("errorTitle");
  const errorMessage = document.getElementById("errorMessage");
  const errorTroubleshoot = document.getElementById("errorTroubleshoot");
  const troubleshootCmd = document.getElementById("troubleshootCmd");

  // State
  let currentTab = "product";
  let lastPayload = null;
  let currentRawText = "";
  let isEditing = false;

  // =========================================================================
  // 1. Connectivity & Ollama Health Checks
  // =========================================================================

  async function checkOllamaHealth() {
    setStatusChecking();
    try {
      const response = await fetch("/api/health");
      const data = await response.json();

      if (data.ollama_connected) {
        if (data.model_available) {
          setStatusOnline(`Ollama Online &bull; ${data.configured_model}`);
          hideAlert();
        } else {
          setStatusWarning(`Ollama Online (Model '${data.configured_model}' not downloaded)`);
          showAlert(
            "Model Not Installed",
            `Ollama is running, but model "${data.configured_model}" is missing. Open your terminal and run: ollama pull ${data.configured_model}`
          );
        }
      } else {
        setStatusOffline("Ollama Offline");
        showAlert(
          "Ollama Service Offline",
          "MarketMint cannot reach Ollama at http://localhost:11434. Make sure the Ollama application is launched."
        );
      }

      // Populate model dropdown with available models
      populateModelList(data.installed_models, data.configured_model);
    } catch (err) {
      console.warn("Health check error:", err);
      setStatusOffline("Ollama Offline");
      showAlert(
        "Connection Error",
        "Unable to communicate with the Flask backend. Please ensure the server is running."
      );
    }
  }

  function setStatusChecking() {
    connectionStatus.className = "status-pill status-checking";
    statusText.textContent = "Checking Ollama...";
  }

  function setStatusOnline(label) {
    connectionStatus.className = "status-pill status-online";
    statusText.innerHTML = label; // safe static string
  }

  function setStatusWarning(label) {
    connectionStatus.className = "status-pill status-warning";
    statusText.textContent = label;
  }

  function setStatusOffline(label) {
    connectionStatus.className = "status-pill status-offline";
    statusText.textContent = label;
  }

  function showAlert(title, message) {
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    ollamaAlert.classList.remove("hidden");
  }

  function hideAlert() {
    ollamaAlert.classList.add("hidden");
  }

  function populateModelList(installedModels, defaultModel) {
    if (!installedModels || !Array.isArray(installedModels)) return;

    const currentSelected = modelSelect.value || defaultModel;
    modelSelect.innerHTML = "";

    // If defaultModel is not in installed list, include it as an option
    const allModels = new Set(installedModels);
    if (defaultModel) allModels.add(defaultModel);

    allModels.forEach((modelName) => {
      const opt = document.createElement("option");
      opt.value = modelName;
      opt.textContent = modelName === defaultModel ? `${modelName} (Default)` : modelName;
      if (modelName === currentSelected) {
        opt.selected = true;
      }
      modelSelect.appendChild(opt);
    });
  }

  refreshStatusBtn.addEventListener("click", () => {
    checkOllamaHealth();
  });

  alertDismissBtn.addEventListener("click", hideAlert);

  // =========================================================================
  // 2. Tab Navigation
  // =========================================================================

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.getAttribute("data-tab");
      switchTab(tabName);
    });
  });

  function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    tabs.forEach((t) => {
      const isActive = t.getAttribute("data-tab") === tabName;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // Update visible forms
    Object.keys(forms).forEach((key) => {
      if (forms[key]) {
        forms[key].classList.toggle("active", key === tabName);
      }
    });
  }

  // =========================================================================
  // 3. Sample Data Loaders
  // =========================================================================

  sampleProductBtn.addEventListener("click", () => {
    document.getElementById("prod_name").value = "Ember & Clay Handcrafted Ceramic Mug";
    document.getElementById("prod_category").value = "Kitchen & Dining / Handmade Crafts";
    document.getElementById("prod_price").value = "₹499 (Free Coaster Included)";
    document.getElementById("prod_features").value =
      "• 350ml generous capacity for coffee, chai, or soup\n" +
      "• Microwave & dishwasher safe natural stoneware\n" +
      "• Lead-free, non-toxic matte glaze finish\n" +
      "• Ergonomic wide thumb-rest handle for cozy grip\n" +
      "• Hand-thrown in small batches by local artisans";
    document.getElementById("prod_audience").value = "Coffee enthusiasts, remote workers, artisanal gift buyers";
    document.getElementById("prod_language").value = "English";
    document.getElementById("prod_tone").value = "Friendly";
  });

  sampleWhatsappBtn.addEventListener("click", () => {
    document.getElementById("wa_product").value = "Artisan Sourdough Weekend Bake Box";
    document.getElementById("wa_details").value =
      "Freshly baked early Saturday morning! Each box contains:\n" +
      "1x Classic Country Sourdough Loaf (fermented 24 hrs)\n" +
      "1x Rosemary & Sea Salt Focaccia slice\n" +
      "Price: ₹350 per box. Orders close Friday at 6:00 PM.\n" +
      "Free pickup at neighborhood bakery or ₹40 local delivery.";
    document.getElementById("wa_audience").value = "Regular bakery customers & neighborhood food lovers";
    document.getElementById("wa_language").value = "English";
    document.getElementById("wa_tone").value = "Friendly";
  });

  sampleSocialBtn.addEventListener("click", () => {
    const igRadio = document.querySelector('input[name="platform"][value="instagram"]');
    if (igRadio) igRadio.checked = true;

    document.getElementById("soc_topic").value = "Micro-Batch Raw Nilgiri Forest Honey";
    document.getElementById("soc_details").value =
      "Ethically harvested from wild bee colonies in the Nilgiri hills.\n" +
      "Unpasteurized, unheated, and coarse-filtered to preserve enzymes & floral pollen.\n" +
      "Only 45 jars available for this spring batch.\n" +
      "Tasting notes of eucalyptus, wild thyme, and golden clover.";
    document.getElementById("soc_audience").value = "Health-conscious consumers, clean eaters, local food advocates";
    document.getElementById("soc_language").value = "English";
    document.getElementById("soc_tone").value = "Persuasive";
  });

  // =========================================================================
  // 4. Form Submission & Generation
  // =========================================================================

  // Attach submit listeners to each generator form
  forms.product.addEventListener("submit", (e) => {
    e.preventDefault();
    handleGenerate("product", forms.product);
  });

  forms.whatsapp.addEventListener("submit", (e) => {
    e.preventDefault();
    handleGenerate("whatsapp", forms.whatsapp);
  });

  forms.social.addEventListener("submit", (e) => {
    e.preventDefault();
    handleGenerate("social", forms.social);
  });

  async function handleGenerate(type, formElement) {
    const formData = new FormData(formElement);
    const payload = {
      type: type,
      model: modelSelect.value || "gemma2:2b"
    };

    formData.forEach((value, key) => {
      payload[key] = value;
    });

    // Save payload for retry
    lastPayload = payload;

    // Check client-side validation
    if (type === "product" && (!payload.product_name || !payload.features)) {
      alert("Please enter both the Product Name and Key Features.");
      return;
    }
    if (type === "whatsapp" && (!payload.product_service || !payload.offer_details)) {
      alert("Please enter both the Product/Service Name and Offer Details.");
      return;
    }
    if (type === "social" && (!payload.product_topic || !payload.details)) {
      alert("Please enter both the Topic and Post Details.");
      return;
    }

    // Set UI to loading state
    setLoadingState(true, type);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        displaySuccess(data);
      } else {
        displayError(data);
      }
    } catch (err) {
      console.error("Generation error:", err);
      displayError({
        error: "Network error: Unable to reach the MarketMint backend. Make sure the Flask app is running."
      });
    } finally {
      setLoadingState(false, type);
    }
  }

  function setLoadingState(isLoading, type) {
    // Disable/enable submit buttons & inputs
    const submitBtns = document.querySelectorAll('.form-actions button[type="submit"]');
    submitBtns.forEach((btn) => {
      btn.disabled = isLoading;
    });

    if (isLoading) {
      resultsEmpty.classList.add("hidden");
      resultsSuccess.classList.add("hidden");
      resultsError.classList.add("hidden");
      charCount.classList.add("hidden");
      copyBtn.classList.add("hidden");
      toggleEditBtn.classList.add("hidden");
      languageNotice.classList.add("hidden");

      resultsLoading.classList.remove("hidden");

      const loadingTitles = {
        product: "Drafting Product Description...",
        whatsapp: "Writing WhatsApp Broadcast...",
        social: "Crafting Social Media Post..."
      };
      document.getElementById("loadingTitle").textContent =
        loadingTitles[type] || "Consulting Local AI...";
    } else {
      resultsLoading.classList.add("hidden");
    }
  }

  // =========================================================================
  // 5. Safe DOM Output Rendering
  // =========================================================================

  function displaySuccess(data) {
    resultsEmpty.classList.add("hidden");
    resultsLoading.classList.add("hidden");
    resultsError.classList.add("hidden");
    resultsSuccess.classList.remove("hidden");

    currentRawText = data.generated_text || "";
    resultsModelBadge.textContent = data.model_used || "Local AI";

    // Update character & word count
    updateCharacterCount(currentRawText);
    charCount.classList.remove("hidden");
    copyBtn.classList.remove("hidden");
    toggleEditBtn.classList.remove("hidden");

    // Populate raw textarea
    rawOutput.value = currentRawText;

    // Show/hide regional language advisory
    if (data.language && data.language !== "English") {
      languageNotice.classList.remove("hidden");
    } else {
      languageNotice.classList.add("hidden");
    }

    // Safely render structured text into DOM
    renderSafeFormattedText(currentRawText);

    // Default to formatted view
    isEditing = false;
    formattedOutput.classList.remove("hidden");
    rawOutput.classList.add("hidden");
    toggleEditText.textContent = "Edit";
  }

  /**
   * Safely parse markdown-like AI response without innerHTML.
   * Creates elements and sets textContent directly.
   */
  function renderSafeFormattedText(text) {
    formattedOutput.innerHTML = ""; // Clear existing output container

    if (!text) return;

    const lines = text.split(/\r?\n/);
    let currentList = null;

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        currentList = null; // Blank line ends a bullet list
        return;
      }

      // Check for headings: # Heading, ## Heading, ### Heading, or **Heading**
      if (/^#{1,4}\s+/.test(trimmed)) {
        currentList = null;
        const cleanHeading = trimmed.replace(/^#{1,4}\s+/, "");
        const h = document.createElement("h3");
        h.className = "output-heading";
        h.textContent = cleanHeading;
        formattedOutput.appendChild(h);
        return;
      }

      // Check for bullet points: - item, * item, • item, or numbered 1. item
      if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        if (!currentList) {
          currentList = document.createElement("ul");
          currentList.className = "output-list";
          formattedOutput.appendChild(currentList);
        }
        const cleanItem = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
        const li = document.createElement("li");
        appendStyledInlineText(li, cleanItem);
        currentList.appendChild(li);
        return;
      }

      // Check for Call to Action block or highlight: "Call to Action:", "CTA:", etc.
      if (/^(Call to Action|CTA|Next Step):/i.test(trimmed)) {
        currentList = null;
        const ctaDiv = document.createElement("div");
        ctaDiv.className = "output-cta";
        appendStyledInlineText(ctaDiv, trimmed);
        formattedOutput.appendChild(ctaDiv);
        return;
      }

      // Standard paragraph
      currentList = null;
      const p = document.createElement("p");
      p.className = "output-paragraph";
      appendStyledInlineText(p, trimmed);
      formattedOutput.appendChild(p);
    });
  }

  /**
   * Parse simple bold (**text**) markers safely using textContent.
   * Splits on `**` and creates alternating normal and <strong> text nodes.
   */
  function appendStyledInlineText(parentEl, text) {
    const parts = text.split(/\*\*/);
    parts.forEach((part, index) => {
      if (!part) return;
      if (index % 2 === 1) {
        // Odd indices are inside **bold**
        const strong = document.createElement("strong");
        strong.textContent = part;
        parentEl.appendChild(strong);
      } else {
        // Even indices are regular text
        const textNode = document.createTextNode(part);
        parentEl.appendChild(textNode);
      }
    });
  }

  function updateCharacterCount(text) {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    charCount.textContent = `${words} words &bull; ${chars} characters`;
    charCount.innerHTML = `${words} words &bull; ${chars} characters`;
  }

  // =========================================================================
  // 6. Error Handling & Diagnostics
  // =========================================================================

  function displayError(data) {
    resultsEmpty.classList.add("hidden");
    resultsLoading.classList.add("hidden");
    resultsSuccess.classList.add("hidden");
    copyBtn.classList.add("hidden");
    toggleEditBtn.classList.add("hidden");
    charCount.classList.add("hidden");
    languageNotice.classList.add("hidden");

    resultsError.classList.remove("hidden");

    const errorMsg = data.error || "An unknown error occurred during generation.";
    errorMessage.textContent = errorMsg;

    if (data.ollama_offline) {
      errorTitle.textContent = "Ollama is Not Running";
      troubleshootCmd.textContent = "ollama serve";
      errorTroubleshoot.classList.remove("hidden");
    } else if (data.model_missing) {
      errorTitle.textContent = "Model Not Found in Ollama";
      const modelName = modelSelect.value || "gemma2:2b";
      troubleshootCmd.textContent = `ollama pull ${modelName}`;
      errorTroubleshoot.classList.remove("hidden");
    } else if (data.timeout) {
      errorTitle.textContent = "Generation Timed Out";
      troubleshootCmd.textContent = "# Local CPU inference can be resource-intensive. Click Retry below.";
      errorTroubleshoot.classList.remove("hidden");
    } else {
      errorTitle.textContent = "Generation Error";
      errorTroubleshoot.classList.add("hidden");
    }
  }

  // Retry Button Handler
  retryBtn.addEventListener("click", () => {
    if (lastPayload && lastPayload.type) {
      const formEl = forms[lastPayload.type];
      if (formEl) {
        handleGenerate(lastPayload.type, formEl);
      }
    }
  });

  // =========================================================================
  // 7. Clipboard Copy & Toggle Editable View
  // =========================================================================

  copyBtn.addEventListener("click", async () => {
    // Get current text (reflecting any manual edits)
    const textToCopy = isEditing ? rawOutput.value : currentRawText;
    if (!textToCopy) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for older browsers
        rawOutput.select();
        document.execCommand("copy");
      }

      // Visual feedback
      copyBtn.classList.add("copied");
      copyBtnText.textContent = "Copied to Clipboard!";
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyBtnText.textContent = "Copy Copy";
      }, 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      alert("Could not copy text automatically. Please select and copy manually.");
    }
  });

  toggleEditBtn.addEventListener("click", () => {
    isEditing = !isEditing;
    if (isEditing) {
      formattedOutput.classList.add("hidden");
      rawOutput.classList.remove("hidden");
      rawOutput.value = currentRawText;
      toggleEditText.textContent = "Formatted View";
      rawOutput.focus();
    } else {
      currentRawText = rawOutput.value;
      renderSafeFormattedText(currentRawText);
      updateCharacterCount(currentRawText);
      formattedOutput.classList.remove("hidden");
      rawOutput.classList.add("hidden");
      toggleEditText.textContent = "Edit";
    }
  });

  // Keep track of edits in textarea
  rawOutput.addEventListener("input", () => {
    currentRawText = rawOutput.value;
    updateCharacterCount(currentRawText);
  });

  // =========================================================================
  // 8. Initial App Initialization
  // =========================================================================
  checkOllamaHealth();
});
