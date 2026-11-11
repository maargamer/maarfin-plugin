(function () {
  'use strict';

  var statusElement = document.getElementById('maarfinStatus');
  var refreshButton = document.getElementById('maarfinRefresh');
  var recentShelf = document.getElementById('maarfinRecent');
  var continueShelf = document.getElementById('maarfinContinue');
  var continueSection = document.getElementById('maarfinContinueSection');
  var recentEmpty = document.getElementById('maarfinRecentEmpty');
  var continueEmpty = document.getElementById('maarfinContinueEmpty');
  var heroTitle = document.getElementById('maarfinHeroTitle');
  var heroOverview = document.getElementById('maarfinHeroOverview');
  var heroImage = document.getElementById('maarfinHeroImage');
  var heroAction = document.getElementById('maarfinHeroAction');
  var themeToggle = document.getElementById('maarfinThemeToggle');
  var featuredItem = null;
  var loadId = 0;
  var themeStorageKey = 'maarfin.theme.enabled';

  function setStatus(message, kind) {
    statusElement.textContent = message;
    statusElement.setAttribute('data-kind', kind || 'info');
  }

  function getThemeEnabled() {
    try {
      return window.localStorage.getItem(themeStorageKey) !== 'false';
    } catch (error) {
      console.error('Maarfin could not read the theme preference.', error);
      return true;
    }
  }

  function setThemeEnabled(enabled) {
    document.documentElement.classList.toggle('maarfin-theme-enabled', enabled);
    try {
      window.localStorage.setItem(themeStorageKey, String(enabled));
    } catch (error) {
      console.error('Maarfin could not save the theme preference.', error);
      setStatus('The theme changed for this page, but Jellyfin could not save your preference.', 'error');
    }
  }

  function openDetails(item) {
    if (!item || !item.Id) {
      return;
    }

    if (window.Dashboard && typeof window.Dashboard.navigate === 'function') {
      window.Dashboard.navigate('details?id=' + encodeURIComponent(item.Id));
      return;
    }

    setStatus('Jellyfin could not open this title from the current page.', 'error');
  }

  function getImageUrl(item, type, maxWidth) {
    if (!window.ApiClient || typeof window.ApiClient.getImageUrl !== 'function') {
      return null;
    }

    var options = {
      type: type,
      maxWidth: maxWidth,
      quality: 82
    };

    if (type === 'Primary' && item.ImageTags && item.ImageTags.Primary) {
      options.tag = item.ImageTags.Primary;
    } else if (type === 'Backdrop' && item.BackdropImageTags && item.BackdropImageTags.length) {
      options.tag = item.BackdropImageTags[0];
    } else {
      return null;
    }

    return window.ApiClient.getImageUrl(item.Id, options);
  }

  function createCard(item, showProgress) {
    var button = document.createElement('button');
    button.className = 'maarfin-card';
    button.type = 'button';
    button.setAttribute('aria-label', 'Open ' + (item.Name || 'media item'));
    button.addEventListener('click', function () {
      openDetails(item);
    });

    var poster = document.createElement('span');
    poster.className = 'maarfin-poster';
    button.appendChild(poster);

    var imageUrl = getImageUrl(item, 'Primary', 420);
    if (imageUrl) {
      var image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.src = imageUrl;
      image.addEventListener('error', function () {
        image.remove();
        addPosterFallback(poster, item);
      });
      poster.appendChild(image);
    } else {
      addPosterFallback(poster, item);
    }

    if (showProgress && item.UserData && item.RunTimeTicks) {
      var runtime = Number(item.RunTimeTicks);
      var position = Number(item.UserData.PlaybackPositionTicks);
      if (runtime > 0 && position > 0) {
        var progress = document.createElement('span');
        progress.className = 'maarfin-progress';
        var progressValue = document.createElement('span');
        progressValue.style.width = Math.min(100, Math.max(0, position / runtime * 100)) + '%';
        progress.appendChild(progressValue);
        poster.appendChild(progress);
      }
    }

    var copy = document.createElement('span');
    copy.className = 'maarfin-card-copy';
    button.appendChild(copy);

    var title = document.createElement('span');
    title.className = 'maarfin-card-title';
    title.textContent = item.Type === 'Episode' && item.SeriesName ? item.SeriesName : item.Name || 'Untitled';
    copy.appendChild(title);

    var meta = document.createElement('span');
    meta.className = 'maarfin-card-meta';
    meta.textContent = getItemMeta(item);
    copy.appendChild(meta);

    return button;
  }

  function addPosterFallback(container, item) {
    if (container.querySelector('.maarfin-poster-fallback')) {
      return;
    }

    var fallback = document.createElement('span');
    fallback.className = 'maarfin-poster-fallback';
    fallback.textContent = (item.Name || '?').charAt(0).toUpperCase();
    container.appendChild(fallback);
  }

  function getItemMeta(item) {
    if (item.Type === 'Episode') {
      var episode = item.ParentIndexNumber && item.IndexNumber
        ? 'Season ' + item.ParentIndexNumber + ' · Episode ' + item.IndexNumber
        : 'TV episode';
      return item.Name ? episode + ' · ' + item.Name : episode;
    }

    var parts = [];
    if (item.ProductionYear) {
      parts.push(String(item.ProductionYear));
    }
    if (item.Type) {
      parts.push(item.Type);
    }
    return parts.join(' · ') || 'In your library';
  }

  function renderShelf(shelf, emptyState, items, showProgress) {
    while (shelf.firstChild) {
      shelf.removeChild(shelf.firstChild);
    }

    items.forEach(function (item) {
      shelf.appendChild(createCard(item, showProgress));
    });

    emptyState.setAttribute('data-visible', items.length ? 'false' : 'true');
  }

  function setFeaturedItem(item) {
    featuredItem = item;
    heroTitle.textContent = item.Name || 'Featured in your library';
    heroOverview.textContent = item.Overview || 'A new favorite is waiting in your Jellyfin library.';
    heroAction.textContent = 'View details';
    heroAction.disabled = false;

    var backdropUrl = getImageUrl(item, 'Backdrop', 1800);
    if (backdropUrl) {
      heroImage.src = backdropUrl;
      heroImage.hidden = false;
      heroImage.addEventListener('error', function () {
        heroImage.hidden = true;
      }, { once: true });
    } else {
      heroImage.hidden = true;
      heroImage.removeAttribute('src');
    }
  }

  async function loadLibrary() {
    var currentLoadId = ++loadId;
    var apiClient = window.ApiClient;
    var userId = apiClient && typeof apiClient.getCurrentUserId === 'function'
      ? apiClient.getCurrentUserId()
      : null;

    if (!apiClient || typeof apiClient.getItems !== 'function' || !userId) {
      setStatus('Maarfin could not connect to Jellyfin. Open this page from the Jellyfin web app and try again.', 'error');
      return;
    }

    refreshButton.disabled = true;
    setStatus('Loading your library…');

    try {
      var results = await Promise.all([
        apiClient.getItems(userId, {
          IncludeItemTypes: 'Movie,Series',
          Recursive: true,
          SortBy: 'DateCreated',
          SortOrder: 'Descending',
          Limit: 16,
          Fields: 'Overview,PrimaryImageAspectRatio,BackdropImageTags'
        }),
        apiClient.getItems(userId, {
          IncludeItemTypes: 'Movie,Episode',
          Filters: 'IsResumable',
          Recursive: true,
          SortBy: 'DatePlayed',
          SortOrder: 'Descending',
          Limit: 12,
          Fields: 'Overview,UserData,SeriesName'
        })
      ]);

      if (currentLoadId !== loadId) {
        return;
      }

      var recentItems = results[0] && results[0].Items ? results[0].Items : [];
      var continueItems = results[1] && results[1].Items ? results[1].Items : [];

      renderShelf(recentShelf, recentEmpty, recentItems, false);
      renderShelf(continueShelf, continueEmpty, continueItems, true);
      continueSection.hidden = !continueItems.length;

      if (recentItems.length) {
        setFeaturedItem(recentItems[0]);
        setStatus('Your Jellyfin library is ready.');
      } else {
        setStatus('Connected to Jellyfin, but no recently added movies or shows were found.');
      }
    } catch (error) {
      if (currentLoadId !== loadId) {
        return;
      }

      console.error('Maarfin could not load the Jellyfin library.', error);
      setStatus('Could not load your library. Check the Jellyfin connection and try refreshing.', 'error');
    } finally {
      if (currentLoadId === loadId) {
        refreshButton.disabled = false;
      }
    }
  }

  refreshButton.addEventListener('click', loadLibrary);
  heroAction.addEventListener('click', function () {
    openDetails(featuredItem);
  });
  themeToggle.checked = getThemeEnabled();
  document.documentElement.classList.toggle('maarfin-theme-enabled', themeToggle.checked);
  themeToggle.addEventListener('change', function () {
    setThemeEnabled(themeToggle.checked);
  });
  loadLibrary();
}());
