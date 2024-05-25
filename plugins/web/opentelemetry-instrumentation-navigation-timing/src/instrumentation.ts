/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { otperformance } from '@opentelemetry/core';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { events, EventLogger } from '@opentelemetry/api-events';
import { PACKAGE_NAME, PACKAGE_VERSION } from './version';

import type {
  // PageNavigationTiming,
  NavigationTimingInstrumentationConfig,
} from './types';


import {
  hasKey,
  PerformanceEntries,
  PerformanceLegacy,
  PerformanceTimingNames as PTN,
} from '@opentelemetry/sdk-trace-web';


export class NavigationTimingInstrumentation extends InstrumentationBase {
  readonly version: string = PACKAGE_VERSION;

  private _eventLogger: EventLogger;
  override _config : NavigationTimingInstrumentationConfig = {};

  /**
   *
   * @param config
   */
  constructor(config: NavigationTimingInstrumentationConfig = {}) {
    super(PACKAGE_NAME, PACKAGE_VERSION, config);
    this._eventLogger = events.getEventLogger('@opentelemetry/instrumentation-navigation-timing');
  }

  init() {}

  private getPerformanceNavigationEntries(): PerformanceEntries {
    let entries: PerformanceEntries = {};
    const performanceNavigationTiming = (
      otperformance as unknown as Performance
    ).getEntriesByType?.('navigation')[0] as PerformanceEntries;
    const keys: (PTN | string)[] = [...Object.values(PTN), "name"];

  
    if (performanceNavigationTiming) {
      keys.forEach((key: string) => {
        if (hasKey(performanceNavigationTiming, key)) {
          entries[key] = performanceNavigationTiming[key];
        }
      });
      // Note that the custom entries are added to the entries object but existing keys are not overwritten
      if (this._config.addCustomEntriesCallback) {
        let entriesCopy: PerformanceEntries = {...entries};
        const newerEntries = this._config.addCustomEntriesCallback(performanceNavigationTiming as Performance, entriesCopy);
        entries = {...newerEntries, ...entries};
      }

    } else {
      // // fallback to previous version
      const perf: typeof otperformance & PerformanceLegacy = otperformance;
      const performanceTiming = perf.timing;
      if (performanceTiming) {
        const keys = Object.values(PTN);
        keys.forEach((key: string) => {
          if (hasKey(performanceTiming, key)) {
            entries[key] = performanceTiming[key];
          }
        });
      }
      // Note that the custom entries are added to the entries object but existing keys are not overwritten
      if (performanceTiming && this._config.addCustomEntriesCallback) {
        let entriesCopy: PerformanceEntries = {...entries};
        const newerEntries = this._config.addCustomEntriesCallback(performanceTiming as PerformanceLegacy, entriesCopy);
        entries = {...newerEntries, ...entries};
      }

    }
  
    return entries
  };

  private _onDocumentLoaded() {
    const entries = this.getPerformanceNavigationEntries();
    this._eventLogger.emit(  { name: 'browser.page_navigation_timing', data: entries as {} }  );
    this._diag.debug('PerformanceNavigationTiming', entries);
  }

  override enable() {
    if (window.document.readyState === 'complete') {
      this._onDocumentLoaded();
    } else {
      this._onDocumentLoaded = this._onDocumentLoaded.bind(this);
      window.addEventListener('load', this._onDocumentLoaded);
    }
  }

  override disable() {
    window.removeEventListener('load', this._onDocumentLoaded);
  }
}
