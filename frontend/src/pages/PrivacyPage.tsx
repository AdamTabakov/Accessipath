import { LegalLayout, LegalSection } from "../components/legal/LegalLayout.js";

export function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Privacy Policy" updated="August 2026">
      <LegalSection title="Our privacy promise">
        <p>
          AccessiPath is built around one idea: accessibility information should be trustworthy,
          transparent, and — wherever possible — processed on your device. Our privacy approach
          follows that same principle. We collect the minimum we need, we never sell personal data,
          and we design the product so that the most sensitive data (your photos and your precise
          location) never has to leave your browser at all.
        </p>
        <p>
          This policy explains what information we handle, why, how long we keep it, and the choices
          you have. "We" means the AccessiPath project and its operators. This policy applies to the
          AccessiPath web application available at our deployed site.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect (and what we deliberately don't)">
        <p>We do not require an account, and we do not collect your name or email address.</p>
        <p>The information we do handle falls into these categories:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-silk">Profile preferences</strong> — your mobility profile
            (wheelchair, walker, cane, etc.), routing preferences (avoid stairs, prefer ramps,
            maximum slope, maximum walking distance). These are stored locally in your browser
            (localStorage) and, if you choose to save them to the server, in our backend database so
            your preferences follow you across devices.
          </li>
          <li>
            <strong className="text-silk">Search queries and route coordinates</strong> — the
            locations you search for and the start/end points you request routes between. These are
            used to calculate routes and are not saved as location history.
          </li>
          <li>
            <strong className="text-silk">Community accessibility reports</strong> — if you submit a
            report, we store the issue type, description, coordinates, and status so other users can
            see it and so routing can account for it.
          </li>
          <li>
            <strong className="text-silk">AI observations</strong> — the structured summary produced
            by on-device analysis (a detected feature label and a confidence score). The photo
            itself is processed on your device and is never uploaded by the analysis feature.
          </li>
        </ul>
        <p>
          We do <strong className="text-silk">not</strong> collect precise location history, we do
          not track your movement over time, and we do not build advertising profiles.
        </p>
      </LegalSection>

      <LegalSection title="Location data">
        <p>
          The "use my location" feature relies on your browser's geolocation and sends your
          coordinates to our routing service solely to compute a route from where you are. That
          coordinate is used for the single routing request; we do not store it as history, and we
          do not log it.
        </p>
        <p>
          Coordinates you enter for a report are stored with the report so that other users can
          locate the issue. Coordinates are never displayed publicly beyond what is needed to show
          the issue on the map, and the data is stored without personal identifiers.
        </p>
      </LegalSection>

      <LegalSection title="On-device AI and your photos">
        <p>
          The accessibility photo analysis runs entirely in your browser using an on-device machine
          learning model (Transformers.js). When you attach a photo to a report, the image is
          processed locally, and the image data is not transmitted to our servers by the analysis
          feature. Only if you choose to submit the report is the photo uploaded as part of that
          report, and the AI observation (a label and confidence score) is attached to it.
        </p>
        <p>
          You can review the AI observation and choose whether to attach it before submitting. If
          you never submit the report, the photo never leaves your device and is discarded when you
          close the page.
        </p>
      </LegalSection>

      <LegalSection title="Community reports and public content">
        <p>
          Reports you submit are visible to other users of the application, along with the issue
          type, description, coordinates, and any AI observation you chose to attach. Please do not
          include personal information (names, contact details, license plates, photos of
          identifiable people) in report descriptions or photos. We may remove content that
          contains personal information or violates our Terms of Use.
        </p>
      </LegalSection>

      <LegalSection title="Third-party data sources">
        <p>
          To provide mapping, search, and routing, AccessiPath sends limited data to established
          third parties, each governed by its own privacy terms:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-silk">OpenStreetMap tiles and Overpass</strong> — map tiles and
            geographic data. Requests include IP addresses, as is standard for web resources.
          </li>
          <li>
            <strong className="text-silk">Nominatim</strong> — free-text geocoding of the addresses
            you search for.
          </li>
          <li>
            <strong className="text-silk">OSRM</strong> — public route calculation for the
            coordinates you request.
          </li>
        </ul>
        <p>
          We do not send your profile preferences, reports, or photos to these services. We
          recommend reviewing their respective privacy policies.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and storage">
        <p>
          We use browser localStorage to remember your preferences. We do not use cookies for
          advertising or cross-site tracking, and we do not run third-party analytics scripts. You
          can clear your preferences at any time by clearing your browser's site data for
          AccessiPath.
        </p>
      </LegalSection>

      <LegalSection title="Data retention and deletion">
        <p>
          Reports are retained to support routing and community awareness. Community reports carry
          an expiration date and are de-emphasized or removed after they expire so temporary
          conditions do not linger. Preferences you store on the server remain until you request
          deletion.
        </p>
        <p>
          To request deletion of a stored profile or a report you submitted, contact us using the
          details at the end of this policy, and we will act on the request within a reasonable
          time. Where we cannot identify you because we store no personal identifiers, we will do
          what we reasonably can to honor the request.
        </p>
      </LegalSection>

      <LegalSection title="Children's privacy">
        <p>
          AccessiPath is a general-purpose navigation tool and is not directed to children under 13.
          We do not knowingly collect personal information from children under 13. If you believe a
          child has provided us personal information, please contact us and we will take steps to
          delete it.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We apply security best practices throughout the application: rate limiting on public and
          expensive endpoints, validation of all input, no secrets in frontend code, restricted
          CORS, hardened HTTP headers, and sanitized error messages. While no system is
          impenetrable, we work to keep your data safe and to limit what we hold so that even a
          compromise would expose as little as possible.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>You have the right to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Choose whether to enable the on-device AI analysis at all.</li>
          <li>Choose whether to attach an AI observation to a report.</li>
          <li>Decide not to use the "use my location" feature.</li>
          <li>Clear locally stored preferences at any time.</li>
          <li>Request access to, correction of, or deletion of personal data we hold about you.</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p>
          Depending on where you live (for example, in Canada or the EU/UK), applicable privacy law
          may grant you additional rights. We honor those rights to the extent we process personal
          data.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy as the service evolves. Material changes will be reflected here
          with a revised "last updated" date. Continued use of AccessiPath after changes take effect
          means you accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions, concerns, or deletion requests:{" "}
          <a
            href="mailto:privacy@accessipath.app"
            className="text-link-blue underline underline-offset-4"
          >
            privacy@accessipath.app
          </a>
          . We will respond as soon as we reasonably can.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}