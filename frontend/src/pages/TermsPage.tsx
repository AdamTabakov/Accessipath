import { LegalLayout, LegalSection } from "../components/legal/LegalLayout.js";

export function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Terms of Use" updated="August 2026">
      <LegalSection title="Acceptance of terms">
        <p>
          Welcome to AccessiPath, an accessibility-first navigation tool. By accessing or using
          AccessiPath (the "Service"), you agree to these Terms of Use (the "Terms"). If you do not
          agree, please do not use the Service. These Terms apply to all visitors, users, and
          contributors.
        </p>
      </LegalSection>

      <LegalSection title="The Service">
        <p>
          The Service helps people with mobility and accessibility needs find routes that are more
          likely to be usable, using OpenStreetMap-based geographic data, institutional
          accessibility information, community reports, and on-device AI observations. The Service
          is provided for informational purposes and does not constitute professional, medical, or
          legal advice.
        </p>
      </LegalSection>

      <LegalSection title="Not medical or safety advice">
        <p>
          Route scores, accessibility statuses, and data confidence values are estimates based on
          incomplete, sometimes outdated, and frequently missing information. A "high" score is not
          a guarantee, and a route we flag as accessible may not be accessible in reality. You are
          solely responsible for your safety and for verifying conditions that matter to you,
          including by contacting the relevant institution or checking the location yourself.
        </p>
        <p>
          <strong className="text-silk">Do not rely on AccessiPath for life-critical navigation.</strong>{" "}
          Always exercise your own judgment, and never assume that missing information means a route
          is safe or inaccessible.
        </p>
      </LegalSection>

      <LegalSection title="Accessibility data is best-effort">
        <p>
          Accessibility information in the Service comes from multiple sources, including
          institutional datasets, OpenStreetMap, community submissions, and on-device AI analysis.
          Each of these sources has limitations:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            OpenStreetMap coverage is sparse; "no data" is treated as unknown, never as proof of
            accessibility.
          </li>
          <li>
            Institutional data may be outdated relative to live conditions.
          </li>
          <li>
            Community reports are unverified user submissions and may be inaccurate, incomplete, or
            expired.
          </li>
          <li>
            AI observations are probabilistic predictions, not facts, and may be wrong.
          </li>
        </ul>
        <p>
          The Service does not fabricate accessibility information, and it keeps these sources
          separate so you can judge each one for yourself.
        </p>
      </LegalSection>

      <LegalSection title="Your use of the Service">
        <p>You agree not to misuse the Service, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Submitting false, misleading, or fraudulent accessibility reports.</li>
          <li>Uploading content that is unlawful, defamatory, or infringes rights of others.</li>
          <li>Uploading photos containing identifiable people, license plates, or other personal
          information.</li>
          <li>Attempting to access, probe, or disrupt the Service, its servers, or its data.</li>
          <li>Automating requests in a way that abuses rate limits or degrades the Service for
          others.</li>
          <li>Using the Service in any way that violates applicable law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Community reports and your content">
        <p>
          When you submit a report, you retain your rights in any original content you provide, and
          you grant us a non-exclusive, worldwide, royalty-free, sublicensable license to host,
          display, and use that content to operate and improve the Service. You confirm that you
          have the right to provide it and that it does not violate these Terms or any third-party
          rights.
        </p>
        <p>
          We may review, edit, or remove reports that violate these Terms, contain personal
          information, or are no longer relevant. Reports never overwrite institutional or
          OpenStreetMap data; they appear as a separate community layer.
        </p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          The AccessiPath name, branding, interface, and original code are the property of the
          AccessiPath project and its contributors. Map data is © OpenStreetMap contributors and is
          used under the Open Database License (ODbL). Accessibility information is sourced from
          OpenStreetMap contributors and, where applicable, from community reports, and remains
          subject to its original rights.
        </p>
        <p>
          You may not copy, modify, distribute, or create derivative works of the Service's
          proprietary code except as permitted by applicable law or the relevant open-source
          license.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>
          The Service relies on third-party services including OpenStreetMap, Nominatim, and OSRM.
          Your use of those services may be subject to their own terms and policies, which we
          encourage you to review. We are not responsible for the availability, accuracy, or
          behavior of third-party services.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers of warranty">
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER
          EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
          WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ACCESSIBILITY INFORMATION IS ACCURATE,
          COMPLETE, OR CURRENT.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER THE ACCESSPATH PROJECT NOR ITS
          CONTRIBUTORS SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR IN CONNECTION
          WITH YOUR USE OF (OR INABILITY TO USE) THE SERVICE — INCLUDING ANY INJURY OR HARM RESULTING
          FROM RELIANCE ON ROUTE OR ACCESSIBILITY INFORMATION. YOUR SOLE AND EXCLUSIVE REMEDY IS TO
          STOP USING THE SERVICE.
        </p>
      </LegalSection>

      <LegalSection title="Indemnification">
        <p>
          You agree to indemnify and hold harmless the AccessiPath project and its contributors from
          and against any claims, damages, liabilities, and expenses (including reasonable legal
          fees) arising out of your use of the Service, your violation of these Terms, or your
          violation of any rights of a third party.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          We may suspend or terminate access to the Service, in whole or in part, at any time and for
          any reason, including violation of these Terms. Provisions of these Terms that by their
          nature should survive termination — including warranties, liability limitations,
          indemnification, and governing law — will survive.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These Terms are governed by the laws of the Province of Ontario, Canada, without regard to
          conflict-of-law principles, and any disputes will be subject to the exclusive jurisdiction
          of the courts of Ontario. This does not limit any mandatory consumer protections available
          to you under the law of your place of residence.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may revise these Terms from time to time. Updated Terms will be posted on this page with
          a revised "last updated" date. Your continued use of the Service after changes take effect
          constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms:{" "}
          <a
            href="mailto:legal@accessipath.app"
            className="text-link-blue underline underline-offset-4"
          >
            legal@accessipath.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}